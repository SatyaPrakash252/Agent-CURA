import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from dotenv import load_dotenv

# Load credentials
load_dotenv(dotenv_path=".env")

class CuraOrchestrator:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("❌ ERROR: GROQ_API_KEY missing!")
            self.llm = None
        else:
            # Llama 3.3 70B is elite for multilingual reasoning
            self.llm = ChatGroq(
                model="llama-3.3-70b-versatile", 
                temperature=0, # Zero temperature for clinical accuracy
                groq_api_key=api_key
            )
        self.parser = JsonOutputParser()

    def process(self, transcript):
        if not self.llm:
            return {"soap": {"subjective": "API Key Missing"}, "intents": []}
            
        template = """
        You are the World's Best Multilingual Medical Scribe Agent.
        
        ### TASKS:
        1. DETECT LANGUAGE: The transcript may be in Hindi, Odia, or English.
        2. TRANSLATE: Convert all clinical findings to professional medical English.
        3. STRUCTURE: Populate the SOAP (Subjective, Objective, Assessment, Plan) format.
        4. ICD-10 CODING: Identify relevant International Classification of Diseases codes.
        5. INTENT EXTRACTION: Identify if the doctor ordered a LAB test, MEDICINE, or FOLLOWUP.

        ### TRANSCRIPT:
        {transcript}
        
        ### OUTPUT RULE:
        Return ONLY a JSON object. If the transcript is garbage or non-medical, 
        return "Awaiting clinical input" in the subjective field.

        JSON STRUCTURE:
        {{
            "soap": {{
                "subjective": "Detailed symptoms and history in English",
                "objective": "Vitals or physical exam findings",
                "assessment": "Clinical impression/Differential diagnosis",
                "plan": "Treatment, medications, and next steps"
            }},
            "billing": [{{ "code": "ICD-10 Code", "desc": "Description" }}],
            "intents": [{{ "type": "LAB/MEDICINE", "item": "Name" }}]
        }}
        """
        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | self.parser
        
        try:
            return chain.invoke({"transcript": transcript})
        except Exception as e:
            return {
                "soap": {"subjective": "Processing Error", "plan": str(e)},
                "billing": [],
                "intents": []
            }