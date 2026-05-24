"""
Project Cura - FHIR Resource Generation Tests.

Tests FHIR resource creation, bundle building, and field validation.
"""

import pytest
from app.services.fhir_bridge import (
    create_bundle,
    create_condition,
    create_encounter,
    create_medication_request,
    create_service_request,
)
from app.models.schemas import SOAPNote


class TestServiceRequest:
    def test_create_lab_order(self):
        sr = create_service_request("PAT-1", "Complete Blood Count (CBC)")
        assert sr["resourceType"] == "ServiceRequest"
        assert sr["status"] == "active"
        assert sr["intent"] == "order"
        assert "PAT-1" in sr["subject"]["reference"]
        assert sr["code"]["text"] == "Complete Blood Count (CBC)"

    def test_unique_ids(self):
        sr1 = create_service_request("PAT-1", "CBC")
        sr2 = create_service_request("PAT-1", "CBC")
        assert sr1["id"] != sr2["id"]


class TestMedicationRequest:
    def test_create_prescription(self):
        mr = create_medication_request("PAT-2", "Amoxicillin", "Amoxicillin 500mg TID x 7d")
        assert mr["resourceType"] == "MedicationRequest"
        assert "PAT-2" in mr["subject"]["reference"]

    def test_medication_text(self):
        mr = create_medication_request("PAT-1", "Ibuprofen", "Ibuprofen 400mg")
        assert "Ibuprofen" in str(mr)


class TestCondition:
    def test_create_condition(self):
        cond = create_condition("PAT-3", "Tension headache", "G44.2")
        assert cond["resourceType"] == "Condition"
        assert "PAT-3" in cond["subject"]["reference"]


class TestEncounter:
    def test_create_encounter(self):
        soap = SOAPNote(
            subjective="Headache",
            objective="Normal",
            assessment="Tension headache",
            plan="Rest",
        )
        enc = create_encounter("PAT-4", "session-1", soap)
        assert enc["resourceType"] == "Encounter"
        assert enc["status"] == "finished"


class TestBundle:
    def test_create_empty_bundle(self):
        bundle = create_bundle("PAT-5", "session-2", [])
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "transaction"
        assert len(bundle["entry"]) == 0

    def test_create_bundle_with_resources(self):
        sr = create_service_request("PAT-5", "CBC")
        bundle = create_bundle("PAT-5", "session-3", [sr])
        assert len(bundle["entry"]) == 1
        assert bundle["entry"][0]["resource"]["resourceType"] == "ServiceRequest"

    def test_bundle_has_identifier(self):
        bundle = create_bundle("PAT-6", "session-4", [])
        # Bundle should have an identifier or id
        assert "id" in bundle or "identifier" in bundle
