import os
import pickle
import re
import json
import shutil
import traceback
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

# Paths
EXCEL_PATH = 'case_priority_system/case_results.xlsx'
MODEL_PATH = 'case_priority_system/models/priority_classifier.pkl'
STATIC_DIR = 'case_priority_system/static'

app = FastAPI(title="Anavaya Judicial Case Priority Dashboard API")

# Initialize and load model
model_data = None
if os.path.exists(MODEL_PATH):
    try:
        with open(MODEL_PATH, 'rb') as f:
            model_data = pickle.load(f)
        print("Model data loaded successfully.")
    except Exception as e:
        print(f"Error loading model data: {e}")
else:
    print(f"Model file not found at {MODEL_PATH}")

# Import comprehensive constitutional analysis module
try:
    from case_priority_system.scripts.constitutional_analysis import (
        get_comprehensive_constitutional_analysis,
    )
    CONSTITUTIONAL_ANALYSIS_AVAILABLE = True
except ImportError:
    try:
        from scripts.constitutional_analysis import (
            get_comprehensive_constitutional_analysis,
        )
        CONSTITUTIONAL_ANALYSIS_AVAILABLE = True
    except ImportError:
        CONSTITUTIONAL_ANALYSIS_AVAILABLE = False
        print("Warning: constitutional_analysis module not found. Enhanced analysis will be unavailable.")

# Import the courtroom (multi-role trial) manager
try:
    from case_priority_system.scripts.courtroom_manager import manager as courtroom_manager
except ImportError:
    try:
        from scripts.courtroom_manager import manager as courtroom_manager
    except ImportError:
        courtroom_manager = None
        print("Warning: courtroom_manager module not found. Trial feature will be unavailable.")


def display_feature_name(feature_name):
    labels = {
        'case_category_enc': 'Legal Category',
        'crime_type_enc': 'Broad Case Type',
        'severity_enc': 'Severity',
        'vulnerability_enc': 'Vulnerability',
        'influence_enc': 'Influence / Power Imbalance',
    }
    return labels.get(feature_name, feature_name.replace('_', ' ').title())

def serialize_tree_node(clf, encoders, feature_names, node_id=0):
    tree = clf.tree_
    class_names = list(encoders['priority'].classes_)
    
    is_leaf = tree.children_left[node_id] == -1
    value = tree.value[node_id][0]
    samples = int(sum(value))
    class_counts = {class_names[i]: int(v) for i, v in enumerate(value)}
    
    if is_leaf:
        pred_class_idx = int(np.argmax(value))
        pred_class = class_names[pred_class_idx]
        return {
            "id": int(node_id),
            "type": "leaf",
            "name": f"Priority: {pred_class}",
            "predicted_class": pred_class,
            "samples": samples,
            "class_counts": class_counts
        }
    else:
        feature_idx = tree.feature[node_id]
        threshold = tree.threshold[node_id]
        feature_name = feature_names[feature_idx]
        
        encoder_keys = {
            'case_category_enc': 'category',
            'crime_type_enc': 'crime',
            'severity_enc': 'severity',
            'vulnerability_enc': 'vulnerability',
            'influence_enc': 'influence',
        }
        
        encoder_key = encoder_keys.get(feature_name)
        encoder = encoders.get(encoder_key)
        
        readable_condition = ""
        left_values = []
        if encoder is not None:
            left_values = [
                str(label)
                for idx, label in enumerate(encoder.classes_)
                if idx <= threshold
            ]
            readable_condition = f"in [{', '.join(left_values)}]"
            name_label = f"{display_feature_name(feature_name)} {readable_condition}"
        else:
            readable_condition = f"<= {threshold:.4f}"
            name_label = f"Keyword '{feature_name}' {readable_condition}"
            
        return {
            "id": int(node_id),
            "type": "decision",
            "name": name_label,
            "feature": feature_name,
            "feature_clean": display_feature_name(feature_name),
            "threshold": float(threshold),
            "readable_condition": readable_condition,
            "left_values": left_values,
            "samples": samples,
            "class_counts": class_counts,
            "children": [
                serialize_tree_node(clf, encoders, feature_names, tree.children_left[node_id]),
                serialize_tree_node(clf, encoders, feature_names, tree.children_right[node_id])
            ]
        }

def safe_transform_encoder(encoders, key, value, default=0):
    encoder = encoders.get(key)
    if encoder is None:
        return default
    if value in encoder.classes_:
        return int(encoder.transform([value])[0])
    return default

@app.post("/api/upload")
async def upload_case(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    filename = file.filename
    temp_pdf_path = os.path.join(".", filename)
    
    try:
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    try:
        try:
            from case_priority_system.scripts.inference_pipeline import (
                extract_text_from_pdf,
                call_gemma_api,
                fallback_extract_features,
                tune_case_features,
                predict_priority,
                get_constitutional_justification,
                get_priority_rules_applied,
                build_decision_path_graph,
            )
        except ImportError:
            from scripts.inference_pipeline import (
                extract_text_from_pdf,
                call_gemma_api,
                fallback_extract_features,
                tune_case_features,
                predict_priority,
                get_constitutional_justification,
                get_priority_rules_applied,
                build_decision_path_graph,
            )
            
        # 1. Extract text
        text = extract_text_from_pdf(temp_pdf_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="The PDF contains no text. Please upload a searchable PDF.")
            
        # 2. Extract features via Gemma (or fallback)
        llm_data = call_gemma_api(text)
        if not llm_data:
            print("Gemma API unavailable or failed. Using fallback heuristics.")
            llm_data = fallback_extract_features(text, filename)
            
        # 3. Tune features
        llm_data = tune_case_features(llm_data, text)
        
        # 4. Predict priority
        if model_data is None:
            raise HTTPException(status_code=500, detail="Decision tree model is not loaded on the server.")
            
        model_text = f"{llm_data.get('plain_summary', '')} {llm_data.get('main_parties', '')}"
        priority = predict_priority(model_data, llm_data, model_text)
        
        # 5. Build decision path report
        decision_graph_path, decision_path = build_decision_path_graph(
            model_data, llm_data, model_text, filename, priority
        )
        
        # 6. Get comprehensive constitutional analysis (State's Perspective)
        if CONSTITUTIONAL_ANALYSIS_AVAILABLE:
            constitutional_analysis = get_comprehensive_constitutional_analysis(llm_data, priority)
            justification = constitutional_analysis["state_perspective_opinion"]
            rules_applied = constitutional_analysis["priority_rules_detailed"]
            balancing_analysis = constitutional_analysis["balancing_analysis"]
            constitutional_rights = constitutional_analysis["constitutional_rights_engaged"]
            state_duty = constitutional_analysis["state_duty_analysis"]
            applicable_doctrines = constitutional_analysis["applicable_doctrines"]
        else:
            justification = get_constitutional_justification(llm_data, priority)
            rules_applied = get_priority_rules_applied(llm_data, priority)
            balancing_analysis = ""
            constitutional_rights = []
            state_duty = ""
            applicable_doctrines = []
        
        # 7. Create new case record with enhanced constitutional analysis
        new_case = {
            'Case_File': filename,
            'Main_Parties': llm_data.get('main_parties', 'Unknown'),
            'Plain_Language_Summary': llm_data.get('plain_summary', 'N/A'),
            'Constitutional_Justification': justification,
            'Priority_Rules_Applied': rules_applied,
            'Decision_Report': decision_graph_path,
            'Decision_Path': decision_path,
            'Predicted_Priority': priority,
            'Category': llm_data.get('case_category', 'N/A'),
            'Broad_Model_Category': llm_data.get('crime_type', 'N/A'),
            'Severity': llm_data.get('severity', 'N/A'),
            'Vulnerability': llm_data.get('vulnerability', 'N/A'),
            'Influence': llm_data.get('influence', 'N/A'),
            'State_Duty_Analysis': state_duty,
            'Rights_Balancing_Analysis': balancing_analysis,
            'Constitutional_Rights_Engaged': constitutional_rights,
            'Applicable_Doctrines': applicable_doctrines,
        }
        
        # 8. Append to EXCEL_PATH
        if os.path.exists(EXCEL_PATH):
            excel_df = pd.read_excel(EXCEL_PATH)
        else:
            excel_df = pd.DataFrame(columns=list(new_case.keys()))
            
        excel_df = excel_df[excel_df['Case_File'] != filename]
        
        new_row_df = pd.DataFrame([new_case])
        excel_df = pd.concat([excel_df, new_row_df], ignore_index=True)
        excel_df.to_excel(EXCEL_PATH, index=False)
        
        return new_case
        
    except Exception as e:
        if os.path.exists(temp_pdf_path):
            try:
                os.remove(temp_pdf_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Error analyzing case document: {str(e)}")

@app.get("/api/cases")
def get_cases():
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=404, detail="Excel results file not found.")
    try:
        df = pd.read_excel(EXCEL_PATH)
        df = df.replace({np.nan: None})
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

@app.get("/api/tree")
def get_tree():
    if model_data is None:
        raise HTTPException(status_code=404, detail="Decision tree model not loaded.")
    try:
        clf = model_data['model']
        encoders = model_data['encoders']
        feature_names = model_data['feature_names']
        
        tree_json = serialize_tree_node(clf, encoders, feature_names, 0)
        return tree_json
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error serializing decision tree: {str(e)}")

@app.get("/api/cases/{case_file}/decision-path")
def get_case_decision_path(case_file: str):
    if model_data is None:
        raise HTTPException(status_code=404, detail="Decision tree model not loaded.")
    if not os.path.exists(EXCEL_PATH):
        raise HTTPException(status_code=404, detail="Excel results file not found.")
        
    try:
        df = pd.read_excel(EXCEL_PATH)
        case_rows = df[df['Case_File'] == case_file]
        if case_rows.empty:
            raise HTTPException(status_code=404, detail=f"Case file {case_file} not found.")
            
        case_data = case_rows.iloc[0].to_dict()
        
        # Extract features and map back to inputs
        category = case_data.get('Category', 'General Civil')
        crime_type = case_data.get('Broad_Model_Category', 'Non-Violent')
        severity = case_data.get('Severity', 'No Injury')
        vulnerability = case_data.get('Vulnerability', 'Low')
        influence = case_data.get('Influence', 'Low')
        plain_summary = case_data.get('Plain_Language_Summary', '')
        main_parties = case_data.get('Main_Parties', '')
        
        # Build X vector
        clf = model_data['model']
        tfidf = model_data['tfidf']
        encoders = model_data['encoders']
        feature_names = model_data['feature_names']
        
        structured_values = {}
        if 'category' in encoders:
            structured_values['case_category_enc'] = safe_transform_encoder(
                encoders, 'category', category
            )
        structured_values.update({
            'crime_type_enc': safe_transform_encoder(encoders, 'crime', crime_type),
            'severity_enc': safe_transform_encoder(encoders, 'severity', severity),
            'vulnerability_enc': safe_transform_encoder(encoders, 'vulnerability', vulnerability),
            'influence_enc': safe_transform_encoder(encoders, 'influence', influence),
        })
        
        description_text = f"{plain_summary} {main_parties}"
        text_feat = tfidf.transform([description_text]).toarray()
        text_df = pd.DataFrame(text_feat, columns=tfidf.get_feature_names_out())
        
        structured_data = pd.DataFrame([structured_values])
        X = pd.concat([structured_data, text_df], axis=1)
        
        if feature_names:
            for column in feature_names:
                if column not in X.columns:
                    X[column] = 0
            X = X[feature_names]
            
        node_indicator = clf.decision_path(X)
        leaf_id = clf.apply(X)[0]
        path_node_ids = [int(nid) for nid in node_indicator.indices[
            node_indicator.indptr[0]:node_indicator.indptr[1]
        ]]
        
        # Compile path details
        tree = clf.tree_
        path_details = []
        
        for idx, node_id in enumerate(path_node_ids):
            is_leaf = node_id == leaf_id
            if is_leaf:
                class_counts = tree.value[node_id][0]
                pred_idx = int(np.argmax(class_counts))
                pred_class = list(encoders['priority'].classes_)[pred_idx]
                path_details.append({
                    "node_id": node_id,
                    "type": "leaf",
                    "title": f"Final Priority: {pred_class}",
                    "condition": "Decision Tree leaf reached.",
                    "case_value": f"{int(sum(class_counts))} samples in training leaf",
                    "result": pred_class,
                    "direction": "final"
                })
            else:
                feature_idx = tree.feature[node_id]
                threshold = tree.threshold[node_id]
                feature_name = feature_names[feature_idx]
                val = float(X.iloc[0, feature_idx])
                
                # Check outcome direction
                went_left = val <= threshold
                direction = "left" if went_left else "right"
                
                encoder_keys = {
                    'case_category_enc': 'category',
                    'crime_type_enc': 'crime',
                    'severity_enc': 'severity',
                    'vulnerability_enc': 'vulnerability',
                    'influence_enc': 'influence',
                }
                
                encoder_key = encoder_keys.get(feature_name)
                encoder = encoders.get(encoder_key)
                
                if encoder is not None:
                    # Categorical feature
                    left_labels = [
                        str(label) for i, label in enumerate(encoder.classes_) if i <= threshold
                    ]
                    condition = f"{display_feature_name(feature_name)} is in: [{', '.join(left_labels)}]"
                    case_val_str = str(encoder.classes_[int(round(val))]) if 0 <= int(round(val)) < len(encoder.classes_) else str(val)
                    result_str = "Yes" if went_left else "No"
                else:
                    # TF-IDF feature
                    condition = f"Keyword '{feature_name}' score <= {threshold:.4f}"
                    case_val_str = f"{val:.4f}"
                    result_str = "Yes" if went_left else "No"
                    
                path_details.append({
                    "node_id": node_id,
                    "type": "decision",
                    "title": f"Split on {display_feature_name(feature_name)}",
                    "condition": condition,
                    "case_value": case_val_str,
                    "result": result_str,
                    "direction": direction
                })
                
        return {
            "case_file": case_file,
            "predicted_priority": case_data.get('Predicted_Priority', 'Unknown'),
            "path_node_ids": path_node_ids,
            "leaf_id": int(leaf_id),
            "steps": path_details
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracing decision path: {str(e)}")

# Mount static files (will serve index.html by default at root)
os.makedirs(STATIC_DIR, exist_ok=True)

# =====================================================================
# COURTROOM (multi-role trial) feature
# Endpoints must be declared BEFORE the catch-all `app.mount("/", ...)`
# below, otherwise the static mount would shadow /court/{room_id}.
# =====================================================================
#
# IMPORTANT: this server must be started with `--ws-ping-interval 0`.
# Uvicorn's default 20s ping interval + 20s pong timeout silently kills
# any WebSocket that doesn't answer a ping within 40s (e.g. a participant
# who goes quiet for a moment, or scripted clients that read in bursts),
# which manifests as sudden disconnects in the live courtroom. Disabling
# pings keeps trial connections stable. See both READMEs for the command.

COURTROOM_HTML = os.path.join(STATIC_DIR, "courtroom.html")


@app.get("/court/{room_id}")
def serve_courtroom(room_id: str):
    """Serve the trial page. The room id is read by the client, not the route."""
    if not os.path.exists(COURTROOM_HTML):
        raise HTTPException(status_code=404, detail="courtroom.html is missing from static/.")
    return FileResponse(COURTROOM_HTML)


@app.post("/api/court/rooms")
def create_courtroom(payload: dict):
    """Create a new trial room. Body: { case_title, created_by }."""
    if courtroom_manager is None:
        raise HTTPException(status_code=503, detail="Courtroom manager not available.")
    case_title = str(payload.get("case_title", "")).strip()
    created_by = str(payload.get("created_by", "")).strip()
    if not case_title:
        raise HTTPException(status_code=400, detail="case_title is required.")
    room = courtroom_manager.create_room(case_title=case_title, created_by=created_by)
    return room.to_dict()


@app.get("/api/court/rooms")
def list_courtrooms():
    """List all trial rooms (active + persisted)."""
    if courtroom_manager is None:
        raise HTTPException(status_code=503, detail="Courtroom manager not available.")
    return courtroom_manager.list_rooms()


@app.get("/api/court/rooms/{room_id}")
def get_courtroom(room_id: str):
    """Public state of one room (roster + transcript)."""
    if courtroom_manager is None:
        raise HTTPException(status_code=503, detail="Courtroom manager not available.")
    room = courtroom_manager.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found.")
    return room.public_state()


@app.get("/api/court/rooms/{room_id}/transcript")
def download_transcript(room_id: str):
    """Download the room transcript as a Markdown file."""
    if courtroom_manager is None:
        raise HTTPException(status_code=503, detail="Courtroom manager not available.")
    room = courtroom_manager.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found.")
    md = courtroom_manager.export_markdown(room_id)
    safe_title = "".join(c if c.isalnum() or c in "- " else "_" for c in room.case_title)[:60]
    filename = f"{safe_title.strip()}_{room_id}_transcript.md"
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.websocket("/ws/court/{room_id}")
async def courtroom_socket(websocket: WebSocket, room_id: str):
    """Signaling + state relay for a trial room.

    Each client identifies itself on connect by sending {type:'join', ...}.
    The server then relays WebRTC signaling (sdp_offer / sdp_answer /
    ice_candidate) peer-to-peer between participants, and broadcasts
    transcript + roster events to the whole room.
    """
    if courtroom_manager is None:
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Courtroom manager not available."})
        await websocket.close()
        return

    await websocket.accept()

    # Track the participant this socket claimed to be, so we can clean up.
    bound_participant_id: str | None = None

    # Live sockets in THIS room, indexed by participant id.
    # Shared on the manager instance so all connections see the same map.
    sockets = courtroom_manager._room_sockets.setdefault(room_id, {})  # type: ignore[attr-defined]

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON."})
                continue

            mtype = msg.get("type")

            # --- join: register a participant ----------------------------------
            if mtype == "join":
                name = str(msg.get("name", "")).strip() or "Anonymous"
                role = str(msg.get("role", "")).strip()
                try:
                    room, participant, display_role = courtroom_manager.join_room(
                        room_id, name, role
                    )
                except ValueError as e:
                    await websocket.send_json({"type": "error", "detail": str(e)})
                    continue

                bound_participant_id = participant.participant_id
                sockets[participant.participant_id] = websocket

                # Tell this client its own identity + the full room snapshot.
                await websocket.send_json({
                    "type": "room_state",
                    "me": {
                        "participant_id": participant.participant_id,
                        "name": participant.name,
                        "role": participant.role,
                        "display_role": display_role,
                    },
                    "room": room.public_state(),
                })

                # Tell everyone else a participant joined (so they initiate
                # a WebRTC offer toward the newcomer after seeing them).
                await _broadcast(sockets, {
                    "type": "participant_joined",
                    "participant": participant.to_dict(),
                    "display_role": display_role,
                    "transcript_entry": room.transcript[-1].to_dict(),
                }, exclude=participant.participant_id)
                continue

            # Everything below requires an identified participant.
            if bound_participant_id is None:
                await websocket.send_json({
                    "type": "error",
                    "detail": "You must join before sending other messages."
                })
                continue

            # --- WebRTC signaling relay (targeted, not broadcast) ------------
            if mtype in ("sdp_offer", "sdp_answer", "ice_candidate"):
                target = msg.get("target_participant_id")
                target_ws = sockets.get(target)
                if target_ws is not None:
                    await target_ws.send_json({
                        "type": mtype,
                        "from_participant_id": bound_participant_id,
                        "data": msg.get("data"),
                    })
                continue

            # --- transcript: statement ---------------------------------------
            if mtype == "statement":
                entry = courtroom_manager.record_statement(
                    room_id, bound_participant_id, msg.get("text", "")
                )
                if entry is not None:
                    await _broadcast(sockets, {
                        "type": "transcript_entry",
                        "entry": entry.to_dict(),
                    })
                continue

            # --- transcript: structured action (objection/ruling/examine) ----
            if mtype == "action":
                entry = courtroom_manager.record_action(
                    room_id, bound_participant_id, msg.get("text", "")
                )
                if entry is not None:
                    await _broadcast(sockets, {
                        "type": "transcript_entry",
                        "entry": entry.to_dict(),
                    })
                continue

            # --- phase change (judge only) -----------------------------------
            if mtype == "set_phase":
                room = courtroom_manager.get_room(room_id)
                me = room.get_participant(bound_participant_id) if room else None
                if me is None or me.role != "Judge":
                    await websocket.send_json({
                        "type": "error",
                        "detail": "Only the Judge may change the phase."
                    })
                    continue
                entry = courtroom_manager.set_phase(room_id, msg.get("phase", ""))
                if entry is not None:
                    await _broadcast(sockets, {
                        "type": "phase_changed",
                        "phase": msg.get("phase"),
                        "transcript_entry": entry.to_dict(),
                    })
                continue

            await websocket.send_json({"type": "error", "detail": f"Unknown message type '{mtype}'."})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Courtroom socket error: {e}")
        traceback.print_exc()
    finally:
        # Clean up: remove the socket and (optionally) the participant.
        if bound_participant_id is not None:
            sockets.pop(bound_participant_id, None)
            if courtroom_manager is not None:
                courtroom_manager.leave_room(room_id, bound_participant_id)
            # Notify the room of the departure + refreshed roster.
            room = courtroom_manager.get_room(room_id) if courtroom_manager else None
            if room is not None:
                try:
                    await _broadcast(sockets, {
                        "type": "participant_left",
                        "participant_id": bound_participant_id,
                        "room": room.public_state(),
                    })
                except Exception as e:
                    print(f"Courtroom finalize broadcast error: {e}")
                    traceback.print_exc()


async def _broadcast(sockets: dict, message: dict, exclude: str | None = None) -> None:
    """Send a message to every socket in a room, optionally skipping one."""
    dead = []
    for pid, ws in list(sockets.items()):
        if pid == exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(pid)
    for pid in dead:
        sockets.pop(pid, None)


# A place to keep the per-room live socket maps. Attached to the manager so the
# endpoint closure above can reach it without globals.
if courtroom_manager is not None and not hasattr(courtroom_manager, "_room_sockets"):
    courtroom_manager._room_sockets = {}  # type: ignore[attr-defined]


@app.get("/")
def read_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Anavaya Dashboard backend is running. Setup the front-end files in static/ directory."}

# Mount static folder
app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")
