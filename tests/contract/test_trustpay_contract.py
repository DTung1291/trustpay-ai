"""Local contract tests with a minimal GenLayer runtime stub.

These tests exercise deterministic state transitions and the custom validator
boundary without requiring a running Studio. Run the official GenLayer test
suite as described in deploy/README.md before publishing a network address.
"""
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest


CLIENT = "0x1111111111111111111111111111111111111111"
FREELANCER = "0x2222222222222222222222222222222222222222"


class UserError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class ConsensusDisagreement(Exception):
    pass


class Address:
    """Model the two string representations observed in GenVM."""

    def __init__(self, value, stringify_as_int=False):
        self.as_hex = value.lower()
        self.as_int = int(self.as_hex, 16)
        self.stringify_as_int = stringify_as_int

    def __str__(self):
        if self.stringify_as_int:
            return str(int(self.as_hex, 16))
        return self.as_hex


class Runtime:
    def __init__(self):
        self.sender = Address(CLIENT)
        self.llm_results = []
        self.web_body = b"public delivery evidence"

    def run_nondet_unsafe(self, leader_fn, validator_fn):
        leader_value = leader_fn()
        if not validator_fn(Return(leader_value)):
            raise ConsensusDisagreement("validator rejected leader result")
        return leader_value


def load_contract(runtime):
    module = types.ModuleType("genlayer")

    class Public:
        @staticmethod
        def write(fn):
            return fn

        @staticmethod
        def view(fn):
            return fn

    class Contract:
        pass

    class U32(int):
        pass

    class Web:
        @staticmethod
        def get(_url):
            # Studionet's GenVM Response currently exposes ``body`` but not
            # ``status_code``; mirror the live runtime so tests catch accidental
            # use of the documentation-only attribute.
            return types.SimpleNamespace(body=runtime.web_body)

    def exec_prompt(_prompt, response_format=None):
        assert response_format == "json"
        return runtime.llm_results.pop(0)

    gl = types.SimpleNamespace(
        Contract=Contract,
        public=Public(),
        message=types.SimpleNamespace(sender_address=runtime.sender),
        message_raw={"datetime": "2026-10-28T14:00:00+00:00"},
        nondet=types.SimpleNamespace(web=Web(), exec_prompt=exec_prompt),
        vm=types.SimpleNamespace(
            UserError=UserError,
            Return=Return,
            run_nondet_unsafe=runtime.run_nondet_unsafe,
        ),
    )
    module.gl = gl
    module.u32 = U32
    module.TreeMap = dict
    module.Address = Address
    module.__all__ = ["gl", "u32", "TreeMap", "Address"]
    sys.modules["genlayer"] = module

    path = Path(__file__).parents[2] / "contracts" / "trustpay_verification.py"
    spec = importlib.util.spec_from_file_location("trustpay_contract_under_test", path)
    contract_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(contract_module)
    return contract_module, gl


class TrustPayContractTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.module, self.gl = load_contract(self.runtime)
        self.contract = self.module.TrustPayVerification()
        self.contract.agreements_json = {}

    def set_sender(self, address):
        self.runtime.sender = Address(address)
        self.gl.message.sender_address = self.runtime.sender

    def create_and_submit(self):
        milestones = json.dumps([{"title": "Ship MVP", "criteria": ["Tests pass"]}])
        agreement_id = self.contract.create_agreement(
            "TrustPay MVP", "Verify the public delivery", Address(FREELANCER), milestones
        )
        self.set_sender(FREELANCER)
        self.contract.accept_agreement(agreement_id)
        self.contract.submit_deliverable(
            agreement_id, 0, "https://github.com/example/repo", "abcdef1"
        )
        return agreement_id

    def test_full_approved_flow_and_read_interface(self):
        agreement_id = self.create_and_submit()
        approved = {
            "criteria_results": [
                {"criterion_index": 0, "met": True, "reason": "Tests are shown passing"}
            ],
            "summary": "The submitted evidence satisfies the criterion.",
        }
        self.runtime.llm_results = [approved, approved]
        self.contract.request_verification(agreement_id, 0)

        self.assertEqual(self.contract.get_agreement_count(), 1)
        self.assertEqual(self.contract.get_agreement(agreement_id)["status"], "COMPLETED")
        milestone = self.contract.get_milestone(agreement_id, 0)
        self.assertEqual(milestone["status"], "APPROVED")
        self.assertEqual(milestone["verified_rounds"], 1)
        self.assertEqual(
            self.contract.get_verification(agreement_id, 0, 1)["outcome"], "APPROVED"
        )
        self.assertEqual(self.contract.get_agreement_ids_for(Address(CLIENT)), [agreement_id])

    def test_address_auth_uses_canonical_hex_not_string_rendering(self):
        agreement_id = self.contract.create_agreement(
            "Title",
            "Description",
            int(FREELANCER, 16),
            json.dumps([{"title": "M1", "criteria": ["C1"]}]),
        )
        self.set_sender(FREELANCER)
        self.contract.accept_agreement(agreement_id)
        self.assertEqual(self.contract.get_agreement(agreement_id)["status"], "ACTIVE")

    def test_validator_disagreement_does_not_consume_round(self):
        agreement_id = self.create_and_submit()
        leader = {
            "criteria_results": [
                {"criterion_index": 0, "met": True, "reason": "Looks complete"}
            ],
            "summary": "Approve",
        }
        validator = {
            "criteria_results": [
                {"criterion_index": 0, "met": False, "reason": "Tests are not demonstrated"}
            ],
            "summary": "Reject",
        }
        self.runtime.llm_results = [leader, validator]

        with self.assertRaises(ConsensusDisagreement):
            self.contract.request_verification(agreement_id, 0)

        milestone = self.contract.get_milestone(agreement_id, 0)
        self.assertEqual(milestone["status"], "EVIDENCE_SUBMITTED")
        self.assertEqual(milestone["rounds_used"], 0)
        self.assertEqual(milestone["verified_rounds"], 0)

    def test_access_control_and_input_validation(self):
        agreement_id = self.contract.create_agreement(
            "Title",
            "Description",
            Address(FREELANCER),
            json.dumps([{"title": "M1", "criteria": ["C1"]}]),
        )
        with self.assertRaisesRegex(UserError, "only freelancer"):
            self.contract.accept_agreement(agreement_id)

        self.set_sender(FREELANCER)
        self.contract.accept_agreement(agreement_id)
        with self.assertRaisesRegex(UserError, "public GitHub hosts only"):
            self.contract.submit_deliverable(
                agreement_id, 0, "https://example.com/private-evidence", ""
            )

    def test_malformed_llm_output_is_inconclusive(self):
        agreement_id = self.create_and_submit()
        malformed = {"unexpected": "shape"}
        self.runtime.llm_results = [malformed, malformed]
        self.contract.request_verification(agreement_id, 0)

        verification = self.contract.get_verification(agreement_id, 0, 1)
        self.assertEqual(verification["outcome"], "INCONCLUSIVE")
        self.assertEqual(
            self.contract.get_milestone(agreement_id, 0)["status"], "AWAITING_EVIDENCE"
        )


if __name__ == "__main__":
    unittest.main()
