import streamlit as st
from engine.orchestrator import CuraOrchestrator
from engine.database import CuraSystem
from engine.safety import CuraSafety
from services.fhir_bridge import FHIRBridge
from engine.transcriber import CuraTranscriber 

st.set_page_config(page_title="Cura Pro Agent", layout="wide", page_icon="🛡️")

# Professional Medical UI Styling
# Updated CSS block in main.py
# Replace your current CSS block in main.py with this:
st.markdown("""
    <style>
    /* GLOBAL DARK THEME FIX */
    [data-testid="stExpander"] {
        background-color: white !important;
        border: 2px solid #004170 !important;
    }
    
    /* FORCE JSON AND TEXT TO BE VISIBLE */
    [data-testid="stJson"] pre, [data-testid="stExpander"] p, [data-testid="stExpander"] span {
        color: #000000 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 14px !important;
    }
    
    .stButton>button { background-color: #004170; color: white; border-radius: 8px; }
    </style>
    """, unsafe_allow_html=True)

st.title("🛡️ Project Cura: Agentic Clinical OS")

# --- SIDEBAR: Multi-Patient Management ---
st.sidebar.header("🏥 Patient Directory")
search_id = st.sidebar.text_input("Enter Patient ID", value="PAT-2026")
st.sidebar.markdown("---")
st.sidebar.success("✅ Cloud: Supabase Active") 
st.sidebar.success("✅ Brain: Llama 3.3 Multilingual") 
st.sidebar.info("📜 Standard: HL7 FHIR R4 Ready") 

# Initialize Engines in Session State once
if 'initialized' not in st.session_state:
    st.session_state.safety = CuraSafety()
    st.session_state.brain = CuraOrchestrator()
    st.session_state.system = CuraSystem()
    st.session_state.transcriber = CuraTranscriber(model_size="small") # Loaded once to save RAM
    st.session_state.live_transcript = ""
    st.session_state.is_listening = False
    st.session_state.analysis = None
    st.session_state.initialized = True

col1, col2 = st.columns(2)

with col1:
    st.header("🎙️ Interaction Layer")
    
    transcript_placeholder = st.empty()
    text_input = transcript_placeholder.text_area(
        "Live Transcript Input", 
        value=st.session_state.live_transcript, 
        height=250
    )

    # UPDATED LISTENING LOGIC
    c1, c2, c3 = st.columns(3)
    with c1:
        if st.button("🎤 Start Listening"):
            st.session_state.is_listening = True
    with c2:
        if st.button("🛑 Stop (Keep Text)"):
            st.session_state.is_listening = False
            st.rerun()
    with c3:
        if st.button("🗑️ Reset/Clear"):
            st.session_state.is_listening = False
            st.session_state.live_transcript = ""
            st.session_state.analysis = None
            st.rerun()

    if st.session_state.is_listening:
        st.markdown('<div class="status-box">🟢 <b>High-Accuracy Mic Active...</b> Speak in English, Hindi, or Odia.</div>', unsafe_allow_html=True)
        # Use the pre-loaded transcriber from session state
        for chunk in st.session_state.transcriber.capture_and_transcribe():
            st.session_state.live_transcript += chunk + " "
            transcript_placeholder.text_area("Live Transcript Input", value=st.session_state.live_transcript, height=250)
            if not st.session_state.is_listening:
                break

    st.markdown("---")
    
    if st.button("🚀 Finalize & Orchestrate", type="primary"):
        if st.session_state.live_transcript.strip():
            with st.spinner("Brain: Perceiving, Planning, Acting..."):
                # 1. PERCEIVE
                safe_text = st.session_state.safety.redact_pii(st.session_state.live_transcript)
                
                # 2. PLAN (Multilingual Support)
                analysis = st.session_state.brain.process(safe_text)
                st.session_state.analysis = analysis
                
                # 3. ACT (FHIR Generation)
                fhir_actions = []
                for intent in analysis.get('intents', []):
                    if intent['type'] in ['LAB', 'TEST', 'MEDICINE']:
                        fhir_actions.append(FHIRBridge.create_lab_order(search_id, intent['item']))
                st.session_state.fhir_actions = fhir_actions
                
                # 4. STORE (Supabase Sync)
                st.session_state.system.save_to_db(search_id, analysis, safe_text)
                st.toast("✅ Digital Twin Updated!")
        else:
            st.error("No input found.")

with col2:
    if st.session_state.analysis:
        st.header("📋 AI Clinical Insight")
        res = st.session_state.analysis
        with st.expander("Structured SOAP Note", expanded=True):
            st.json(res['soap'])
        
        if st.session_state.get('fhir_actions'):
            st.subheader("⚙️ Autonomous Tool Calls")
            for i, fhir_res in enumerate(st.session_state.fhir_actions):
                test_name = fhir_res['code']['text']
                st.warning(f"ACTION: Drafted {fhir_res['resourceType']} for {test_name}")
                if st.button(f"Confirm & Transmit: {test_name}", key=f"tx_{i}"):
                    st.balloons()
                    st.success(f"Transmitted to FHIR Gateway.")
    else:
        st.info("Awaiting analysis...")

    st.markdown("---")
    st.header("⏳ Longitudinal History")
    if st.button("📂 Fetch Records"):
        with st.spinner("Searching cloud..."):
            history = st.session_state.system.client.table("consultations")\
                .select("*").eq("patient_id", search_id).order("created_at", desc=True).execute()
            
            if history.data:
                for record in history.data:
                    date = record['created_at'][:10]
                    with st.expander(f"Visit: {date} | {record['assessment'][:40]}..."):
                        st.write(f"**Subjective:** {record['subjective']}")
                        st.write(f"**Assessment:** {record['assessment']}")
                        st.write(f"**Plan:** {record['plan']}")
            else:
                st.warning("No records found.")  