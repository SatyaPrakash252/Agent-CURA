from supabase import create_client
import os

class CuraSystem:
    def __init__(self):
        self.client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

    def save_to_db(self, p_id, analysis, transcript):
        data = {
            "patient_id": p_id,
            "subjective": analysis['soap']['subjective'],
            "assessment": analysis['soap']['assessment'],
            "plan": analysis['soap']['plan'],
            "raw_transcript": transcript,
            "fhir_payload": analysis.get('intents', [])
        }
        return self.client.table("consultations").insert(data).execute()