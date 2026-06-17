import os
import shutil
import io
import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from xgboost import XGBRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.parser import parse_las_file, parse_text_file, clean_json_val
from backend.engine import (
    vclgr, vclsp, vclrt, vclnd,
    phis_w, phis_w_sh_corr, phis_rhg, phis_rhg_sh_corr,
    phid, phid_sh_corr, phin_sh_corr, phixnd,
    sw_archie, calculate_net_pay
)

app = FastAPI(title="Elogant API", version="2.0.0")

# Enable CORS for Next.js dev server on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "./data"
os.makedirs(DATA_DIR, exist_ok=True)

@app.on_event("startup")
def on_startup():
    """Initializes SQLite DB and pre-loads example logs from local folders."""
    from backend.database import init_db, get_well_by_filename, add_well, save_well_curves
    
    init_db()
    
    source_dir = DATA_DIR
    if not os.path.exists(source_dir) or len([f for f in os.listdir(source_dir) if f.lower().endswith((".las", ".txt"))]) == 0:
        source_dir = "./PytroFizik/data"
        
    try:
        if os.path.exists(source_dir):
            for filename in os.listdir(source_dir):
                if filename.lower().endswith((".las", ".txt")):
                    filepath = os.path.join(source_dir, filename)
                    
                    if source_dir != DATA_DIR:
                        shutil.copy(filepath, os.path.join(DATA_DIR, filename))
                        filepath = os.path.join(DATA_DIR, filename)
                        
                    existing = get_well_by_filename(filename)
                    if not existing:
                        print(f"Pre-loading {filename} into SQLite database...")
                        if filename.lower().endswith(".las"):
                            parsed = parse_las_file(filepath)
                        else:
                            parsed = parse_text_file(filepath)
                            
                        summary = parsed["summary"]
                        well_id = add_well(
                            filename=filename,
                            well_name=summary.get("well_name", filename),
                            field=summary.get("field", "Unknown"),
                            company=summary.get("company", "Unknown"),
                            start_depth=summary.get("start_depth", 0.0),
                            stop_depth=summary.get("stop_depth", 0.0),
                            step=summary.get("step", 0.0),
                            null_val=summary.get("null_val", -999.25),
                            api_uwi=summary.get("api", "Unknown"),
                            depth_unit=summary.get("depth_unit", "ft")
                        )
                        df = pd.DataFrame(parsed["data"])
                        save_well_curves(well_id, df)
                        print(f"Pre-loaded {filename} successfully with ID {well_id}.")
    except Exception as e:
        print(f"Error pre-loading files on startup: {str(e)}")

# ==========================================
# Schema definitions
# ==========================================

class CalculationRequest(BaseModel):
    well_id: Optional[int] = None
    data: List[Dict[str, Any]]
    depth_col: str = "DEPT"
    gr_col: Optional[str] = "GR"
    sp_col: Optional[str] = "SP"
    rt_col: Optional[str] = "ILD"
    neut_col: Optional[str] = "NPHI"
    den_col: Optional[str] = "RHOB"
    dt_col: Optional[str] = "DT"
    
    # Calculations parameters
    gr_clean: float = 40.0
    gr_clay: float = 135.0
    vcl_gr_correction: Optional[str] = "linear"
    
    sp_clean: float = -60.0
    sp_clay: float = 2.0
    
    rt_clean: float = 2.0
    rt_clay: float = 2.0
    
    neut_clean1: float = 15.0
    den_clean1: float = 2.6
    neut_clean2: float = 40.0
    den_clean2: float = 2.0
    neut_clay: float = 47.5
    den_clay: float = 2.8
    
    dt_ma: float = 55.5
    dt_fl: float = 188.0
    dt_sh: float = 90.0
    cp: float = 1.0
    alpha: float = 0.625
    den_ma: float = 2.65
    den_fl: float = 1.10
    den_sh: float = 2.40
    phin_sh: float = 45.0
    
    porosity_method: str = "density_neutron"
    
    rw: float = 0.45
    a: float = 1.0
    m: float = 1.8
    n: float = 2.0
    
    vcl_cutoff: float = 0.4
    phie_cutoff: float = 0.1
    sw_cutoff: float = 0.5

class DespikeRequest(BaseModel):
    well_id: Optional[int] = None
    data: List[Dict[str, Any]]
    column: str
    window_size: int = 5

class CleanRequest(BaseModel):
    well_id: Optional[int] = None
    data: List[Dict[str, Any]]
    column: str
    method: str = "both"
    min_val: Optional[float] = None
    max_val: Optional[float] = None

class MergeRequest(BaseModel):
    well_id: Optional[int] = None
    data: List[Dict[str, Any]]
    primary_col: str
    secondary_col: str
    output_col: str
    merge_strategy: str = "prefer_primary"

class MLPredictRequest(BaseModel):
    train_well_id: Optional[int] = None
    predict_well_id: Optional[int] = None
    train_data: List[Dict[str, Any]]
    predict_data: List[Dict[str, Any]]
    features: List[str]
    target: str
    model_type: str = "xgboost"

class SaveScenarioRequest(BaseModel):
    well_id: int
    name: str
    folder: str = "Uncategorized"
    settings: Dict[str, Any]

# ==========================================
# REST API endpoints
# ==========================================

@app.get("/api/list-files")
def list_files():
    """Returns registry list of well logs in SQLite database."""
    from backend.database import get_wells_list
    try:
        wells = get_wells_list()
        return {
            "wells": wells,
            "files": [w["filename"] for w in wells]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/load-file")
def load_file(filename: str = Query(...)):
    """Loads well metadata and curves datasets from SQLite database."""
    from backend.database import get_well_by_filename, get_well_curves_df
    
    well = get_well_by_filename(filename)
    if not well:
        raise HTTPException(status_code=404, detail="Well not found in database")
        
    try:
        df = get_well_curves_df(well["id"])
        df_clean = df.where(pd.notnull(df), None)
        data_records = df_clean.to_dict(orient="records")
        
        curves = []
        for col in df.columns:
            if col != "DEPT":
                curves.append({
                    "mnemonic": col,
                    "unit": "unit" if col not in ["ILD", "ILM", "LL8", "LLD", "Rt"] else "ohm.m",
                    "descr": f"{col} Log Curve",
                    "has_data": True
                })
                
        return clean_json_val({
            "summary": {
                "well_name": well["well_name"],
                "field": well["field"],
                "company": well["company"],
                "start_depth": well["start_depth"],
                "stop_depth": well["stop_depth"],
                "step": well["step"],
                "null_val": well["null_val"],
                "api": well["api_uwi"],
                "depth_unit": well.get("depth_unit", "ft")
            },
            "well_id": well["id"],
            "curves": curves,
            "data": data_records
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-file")
async def upload_file(file: UploadFile = File(...)):
    """Uploads a well log file, parses it, and writes the contents to SQLite database."""
    from backend.database import add_well, save_well_curves
    
    filename = file.filename
    if not filename.lower().endswith((".las", ".txt", ".csv")):
        raise HTTPException(status_code=400, detail="Only LAS or formatted ASCII files (.txt, .csv) are supported")
        
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if filename.lower().endswith(".las"):
            parsed_data = parse_las_file(filepath)
        else:
            parsed_data = parse_text_file(filepath)
            
        summary = parsed_data["summary"]
        well_id = add_well(
            filename=filename,
            well_name=summary.get("well_name", filename),
            field=summary.get("field", "Unknown"),
            company=summary.get("company", "Unknown"),
            start_depth=summary.get("start_depth", 0.0),
            stop_depth=summary.get("stop_depth", 0.0),
            step=summary.get("step", 0.0),
            null_val=summary.get("null_val", -999.25),
            api_uwi=summary.get("api", "Unknown"),
            depth_unit=summary.get("depth_unit", "ft")
        )
        
        df = pd.DataFrame(parsed_data["data"])
        save_well_curves(well_id, df)
        
        return load_file(filename=filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calculate")
def calculate(req: CalculationRequest):
    """Executes petrophysical logs math calculations engine."""
    df = pd.DataFrame(req.data)
    if req.depth_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Depth column '{req.depth_col}' not found")
        
    gr = df[req.gr_col].values if req.gr_col in df.columns else np.nan
    sp = df[req.sp_col].values if req.sp_col in df.columns else np.nan
    rt = df[req.rt_col].values if req.rt_col in df.columns else np.nan
    nphi = df[req.neut_col].values if req.neut_col in df.columns else np.nan
    rhob = df[req.den_col].values if req.den_col in df.columns else np.nan
    dt = df[req.dt_col].values if req.dt_col in df.columns else np.nan
    
    # 1. Calculate clay volumes (VCL)
    vcl_gr_arr = [vclgr(val, req.gr_clean, req.gr_clay, req.vcl_gr_correction) for val in gr] if not np.isnan(gr).all() else [0.0]*len(df)
    vcl_sp_arr = [vclsp(val, req.sp_clean, req.sp_clay) for val in sp] if not np.isnan(sp).all() else [0.0]*len(df)
    vcl_rt_arr = [vclrt(val, req.rt_clean, req.rt_clay) for val in rt] if not np.isnan(rt).all() else [0.0]*len(df)
    
    vcl_nd_arr = [0.0]*len(df)
    if not np.isnan(nphi).all() and not np.isnan(rhob).all():
        nphi_norm = [val if val < 1.0 else val / 100.0 for val in nphi]
        vcl_nd_arr = [
            vclnd(n, r, req.neut_clean1/100.0, req.den_clean1, req.neut_clean2/100.0, req.den_clean2, req.neut_clay/100.0, req.den_clay)
            for n, r in zip(nphi_norm, rhob)
        ]
        
    df["VCL_GR"] = vcl_gr_arr
    df["VCL_SP"] = vcl_sp_arr
    df["VCL_RT"] = vcl_rt_arr
    df["VCL_ND"] = vcl_nd_arr
    
    # Select preferred baseline VCL
    if not np.isnan(gr).all():
        df["VCL"] = df["VCL_GR"]
    elif not np.isnan(nphi).all() and not np.isnan(rhob).all():
        df["VCL"] = df["VCL_ND"]
    else:
        df["VCL"] = df["VCL_SP"]
        
    vcl_vals = df["VCL"].values
    
    # 2. Porosity Calculations
    if not np.isnan(dt).all():
        df["PHIS_W"] = [phis_w(val, req.dt_ma, req.dt_fl, req.cp) for val in dt]
        df["PHIS_W_SHC"] = [phis_w_sh_corr(d, req.dt_ma, req.dt_fl, req.cp, req.dt_sh, v) for d, v in zip(dt, vcl_vals)]
        df["PHIS_RHG"] = [phis_rhg(val, req.dt_ma, req.alpha) for val in dt]
        df["PHIS_RHG_SHC"] = [phis_rhg_sh_corr(d, req.dt_ma, req.dt_sh, v, req.dt_fl) for d, v in zip(dt, vcl_vals)]
    else:
        for c in ["PHIS_W", "PHIS_W_SHC", "PHIS_RHG", "PHIS_RHG_SHC"]:
            df[c] = np.nan
            
    if not np.isnan(rhob).all():
        df["PHID"] = [phid(val, req.den_ma, req.den_fl, req.den_sh, v) for val, v in zip(rhob, vcl_vals)]
        df["PHID_SHC"] = [phid_sh_corr(val, req.den_ma, req.den_fl, req.den_sh, v) for val, v in zip(rhob, vcl_vals)]
    else:
        df["PHID"] = np.nan
        df["PHID_SHC"] = np.nan
        
    if not np.isnan(nphi).all():
        nphi_pct = [val if val > 1.0 else val * 100.0 for val in nphi]
        df["PHIN"] = [val / 100.0 for val in nphi_pct]
        df["PHIN_SHC"] = [phin_sh_corr(val, req.phin_sh, v) for val, v in zip(nphi_pct, vcl_vals)]
    else:
        df["PHIN"] = np.nan
        df["PHIN_SHC"] = np.nan
        
    if "PHIN_SHC" in df.columns and "PHID_SHC" in df.columns and not df["PHIN_SHC"].isna().all() and not df["PHID_SHC"].isna().all():
        df["PHIxND"] = [phixnd(n, r) for n, r in zip(df["PHIN_SHC"].values, df["PHID_SHC"].values)]
    else:
        df["PHIxND"] = np.nan
        
    # Map method
    if req.porosity_method == "density_neutron" and "PHIxND" in df.columns and not df["PHIxND"].isna().all():
        df["PHIE"] = df["PHIxND"]
        df["PHIT"] = df["PHID"].fillna(0.0) / 2.0 + df["PHIN"].fillna(0.0) / 2.0
    elif req.porosity_method == "density" and "PHID_SHC" in df.columns and not df["PHID_SHC"].isna().all():
        df["PHIE"] = df["PHID_SHC"]
        df["PHIT"] = df["PHID"]
    elif req.porosity_method == "sonic_willie" and "PHIS_W_SHC" in df.columns and not df["PHIS_W_SHC"].isna().all():
        df["PHIE"] = df["PHIS_W_SHC"]
        df["PHIT"] = df["PHIS_W"]
    elif req.porosity_method == "sonic_rhg" and "PHIS_RHG_SHC" in df.columns and not df["PHIS_RHG_SHC"].isna().all():
        df["PHIE"] = df["PHIS_RHG_SHC"]
        df["PHIT"] = df["PHIS_RHG"]
    elif req.porosity_method == "neutron" and "PHIN_SHC" in df.columns and not df["PHIN_SHC"].isna().all():
        df["PHIE"] = df["PHIN_SHC"]
        df["PHIT"] = df["PHIN"]
    else:
        df["PHIE"] = df["PHIxND"].fillna(df["PHID_SHC"]).fillna(df["PHIS_W_SHC"]).fillna(0.0)
        df["PHIT"] = df["PHIE"]
        
    # 3. Calculate Water Saturation
    phie_vals = df["PHIE"].values
    if not np.isnan(rt).all():
        df["SW"] = [sw_archie(req.rw, r, p, req.a, req.m, req.n) for r, p in zip(rt, phie_vals)]
    else:
        df["SW"] = 1.0
        
    df["BVW"] = df["SW"] * df["PHIE"]
    df["matrix"] = (1.0 - df["VCL"] - df["PHIE"]).clip(0, 1)
    
    df = df.fillna(0.0)
    
    # 4. Reservoir Net Pay
    net_pay_results = calculate_net_pay(
        df=df, depth_col=req.depth_col, vcl_col="VCL", phie_col="PHIE", sw_col="SW",
        vcl_cutoff=req.vcl_cutoff, phie_cutoff=req.phie_cutoff, sw_cutoff=req.sw_cutoff
    )
    
    # Save results to SQLite if well ID is loaded
    if req.well_id is not None:
        from backend.database import update_well_calculated_curves
        try:
            calc_df = pd.DataFrame()
            calc_df["DEPT"] = df[req.depth_col]
            cols_to_save = ["VCL", "VCL_GR", "VCL_SP", "VCL_RT", "VCL_ND", "PHIS_W", 
                            "PHIS_W_SHC", "PHIS_RHG", "PHIS_RHG_SHC", "PHID", "PHID_SHC", 
                            "PHIN", "PHIN_SHC", "PHIxND", "PHIE", "PHIT", "SW", "BVW", "matrix"]
            for c in cols_to_save:
                if c in df.columns:
                    calc_df[c] = df[c]
            calc_df["PAY_FLAG"] = net_pay_results["flags"]["pay"]
            calc_df["RESERVOIR_FLAG"] = net_pay_results["flags"]["reservoir"]
            calc_df["SAND_FLAG"] = net_pay_results["flags"]["sand"]
            update_well_calculated_curves(req.well_id, calc_df)
        except Exception as e:
            print(f"Error caching calculated curves: {str(e)}")
            
    df_clean = df.where(pd.notnull(df), None)
    return clean_json_val({
        "data": df_clean.to_dict(orient="records"),
        "metrics": net_pay_results
    })

# ==========================================
# Wrangling & Cleansing API endpoints
# ==========================================

@app.post("/api/wrangle/despike")
def despike_route(req: DespikeRequest):
    df = pd.DataFrame(req.data)
    if req.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Curve {req.column} not found in logs dataset")
        
    s = pd.to_numeric(df[req.column], errors='coerce')
    rolling_med = s.rolling(window=req.window_size, center=True, min_periods=1).median()
    diff = (s - rolling_med).abs()
    std_val = s.std()
    threshold = 3.0 * std_val if (not np.isnan(std_val) and std_val > 0) else 10.0
    outliers = diff > threshold
    s[outliers] = rolling_med[outliers]
    df[req.column] = s
    
    if req.well_id is not None:
        from backend.database import update_well_calculated_curves
        try:
            calc_df = pd.DataFrame()
            calc_df["DEPT"] = df["DEPT"]
            calc_df[req.column] = df[req.column]
            update_well_calculated_curves(req.well_id, calc_df)
        except Exception as e:
            print(f"Error saving despike calculations: {str(e)}")
            
    df_clean = df.where(pd.notnull(df), None)
    return clean_json_val({"data": df_clean.to_dict(orient="records")})

@app.post("/api/wrangle/clean")
def clean_route(req: CleanRequest):
    df = pd.DataFrame(req.data)
    if req.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Curve {req.column} not found in logs dataset")
        
    s = pd.to_numeric(df[req.column], errors='coerce')
    if req.method in ["interpolate", "both"]:
        s = s.interpolate(method='linear', limit_direction='both')
    if req.method in ["clip", "both"]:
        if req.min_val is not None or req.max_val is not None:
            s = s.clip(lower=req.min_val, upper=req.max_val)
    df[req.column] = s
    
    if req.well_id is not None:
        from backend.database import update_well_calculated_curves
        try:
            calc_df = pd.DataFrame()
            calc_df["DEPT"] = df["DEPT"]
            calc_df[req.column] = df[req.column]
            update_well_calculated_curves(req.well_id, calc_df)
        except Exception as e:
            print(f"Error saving cleansing calculations: {str(e)}")
            
    df_clean = df.where(pd.notnull(df), None)
    return clean_json_val({"data": df_clean.to_dict(orient="records")})

@app.post("/api/wrangle/merge")
def merge_route(req: MergeRequest):
    df = pd.DataFrame(req.data)
    if req.primary_col not in df.columns or req.secondary_col not in df.columns:
        raise HTTPException(status_code=400, detail="Primary or Secondary curves missing")
        
    p = pd.to_numeric(df[req.primary_col], errors='coerce')
    s = pd.to_numeric(df[req.secondary_col], errors='coerce')
    
    if req.merge_strategy == "prefer_primary":
        merged = p.fillna(s)
    elif req.merge_strategy == "prefer_secondary":
        merged = s.fillna(p)
    elif req.merge_strategy == "average":
        merged = (p + s) / 2.0
        merged = merged.fillna(p).fillna(s)
    else:
        merged = p.fillna(s)
        
    df[req.output_col] = merged
    
    if req.well_id is not None:
        from backend.database import update_well_calculated_curves
        try:
            calc_df = pd.DataFrame()
            calc_df["DEPT"] = df["DEPT"]
            calc_df[req.output_col] = df[req.output_col]
            update_well_calculated_curves(req.well_id, calc_df)
        except Exception as e:
            print(f"Error saving merge calculations: {str(e)}")
            
    df_clean = df.where(pd.notnull(df), None)
    return clean_json_val({"data": df_clean.to_dict(orient="records")})

# ==========================================
# AI Sonic Prediction Endpoints
# ==========================================

@app.post("/api/ml/predict")
def ml_predict(req: MLPredictRequest):
    df_train = pd.DataFrame(req.train_data)
    df_pred = pd.DataFrame(req.predict_data)
    
    missing_features = [f for f in req.features if f not in df_train.columns]
    if missing_features:
        raise HTTPException(status_code=400, detail=f"Missing features in train data: {missing_features}")
    if req.target not in df_train.columns:
        raise HTTPException(status_code=400, detail=f"Target {req.target} missing in train dataset")
        
    train_clean = df_train.dropna(subset=req.features + [req.target])
    if len(train_clean) == 0:
        raise HTTPException(status_code=400, detail="No valid clean target records found for training")
        
    X_train = train_clean[req.features]
    y_train = train_clean[req.target]
    
    if req.model_type == "xgboost":
        model = XGBRegressor()
    else:
        model = LinearRegression()
        
    model.fit(X_train, y_train)
    y_train_pred = model.predict(X_train)
    mae = mean_absolute_error(y_train, y_train_pred)
    
    df_pred_features = df_pred[req.features].copy()
    for col in req.features:
        if col in df_pred_features.columns:
            df_pred_features[col] = pd.to_numeric(df_pred_features[col], errors='coerce')
            df_pred_features[col] = df_pred_features[col].fillna(df_pred_features[col].mean()).fillna(0.0)
            
    predictions = model.predict(df_pred_features)
    out_col = f"{req.target}_PRED"
    df_pred[out_col] = predictions.tolist()
    
    if req.predict_well_id is not None:
        from backend.database import update_well_calculated_curves
        try:
            calc_df = pd.DataFrame()
            calc_df["DEPT"] = df_pred["DEPT"]
            calc_df[out_col] = df_pred[out_col]
            update_well_calculated_curves(req.predict_well_id, calc_df)
        except Exception as e:
            print(f"Error saving ML predictions: {str(e)}")
            
    df_clean = df_pred.where(pd.notnull(df_pred), None)
    return clean_json_val({
        "data": df_clean.to_dict(orient="records"),
        "mae": float(mae),
        "predicted_col": out_col
    })

# ==========================================
# Scenario Settings Endpoints
# ==========================================

@app.post("/api/save-scenario")
def save_scenario_route(req: SaveScenarioRequest):
    from backend.database import save_scenario
    try:
        sc_id = save_scenario(req.well_id, req.name, req.folder, req.settings)
        return {"status": "success", "scenario_id": sc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/scenarios")
def get_scenarios_route(well_id: Optional[int] = None):
    from backend.database import get_scenarios_list
    try:
        scenarios = get_scenarios_list(well_id)
        return {"scenarios": scenarios}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-scenario/{scenario_id}")
def delete_scenario_route(scenario_id: int):
    from backend.database import delete_scenario
    try:
        delete_scenario(scenario_id)
        return {"status": "success", "message": f"Scenario {scenario_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-well/{well_id}")
def delete_well_route(well_id: int):
    from backend.database import delete_well
    try:
        delete_well(well_id)
        return {"status": "success", "message": f"Well {well_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PDF Report Export Endpoint
# ==========================================

@app.post("/api/export-pdf")
def export_pdf(payload: Dict[str, Any]):
    well = payload.get("well", {})
    metrics = payload.get("metrics", {})
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#865be9'),
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=colors.HexColor('#1f2937'),
        spaceBefore=10,
        spaceAfter=8
    )
    
    body_style = styles['Normal']
    
    # Title Header
    story.append(Paragraph("Elogant Petrophysical Analysis Report", title_style))
    story.append(Spacer(1, 10))
    
    # Metadata table
    story.append(Paragraph("Well Registry Information", h2_style))
    well_data = [
        [Paragraph("<b>Parameter</b>", body_style), Paragraph("<b>Metadata Details</b>", body_style)],
        [Paragraph("Well Name", body_style), Paragraph(well.get("well_name", "Unknown"), body_style)],
        [Paragraph("Field Name", body_style), Paragraph(well.get("field", "Unknown"), body_style)],
        [Paragraph("Company", body_style), Paragraph(well.get("company", "Unknown"), body_style)],
        [Paragraph("UWI / API Number", body_style), Paragraph(well.get("api", "Unknown"), body_style)],
        [Paragraph("Analyzed Interval Range", body_style), Paragraph(f"{well.get('start_depth', 0.0)} - {well.get('stop_depth', 0.0)} ft", body_style)],
    ]
    t1 = Table(well_data, colWidths=[150, 350])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t1)
    story.append(Spacer(1, 15))
    
    # Pay summary table
    story.append(Paragraph("Petrophysical Interpretation Results Summary", h2_style))
    metrics_data = [
        [Paragraph("<b>Quality Metric</b>", body_style), Paragraph("<b>Calculated Value</b>", body_style)],
        [Paragraph("Gross Interval Thickness", body_style), Paragraph(f"{metrics.get('gross_thickness', 0.0):.1f} ft", body_style)],
        [Paragraph("Net Sand Thickness (VCL Cut-off)", body_style), Paragraph(f"{metrics.get('net_sand', 0.0):.1f} ft", body_style)],
        [Paragraph("Net Reservoir Thickness (PHIE Cut-off)", body_style), Paragraph(f"{metrics.get('net_reservoir', 0.0):.1f} ft", body_style)],
        [Paragraph("Net Pay Thickness (Sw Cut-off)", body_style), Paragraph(f"{metrics.get('net_pay', 0.0):.1f} ft", body_style)],
        [Paragraph("Net-to-Gross (NTG) Ratio", body_style), Paragraph(f"{metrics.get('ntg', 0.0):.3f}", body_style)],
        [Paragraph("Mean Volume of Clay in Pay Zone", body_style), Paragraph(f"{metrics.get('mean_vcl_pay', 0.0)*100.0:.1f} %", body_style)],
        [Paragraph("Mean Effective Porosity in Pay Zone", body_style), Paragraph(f"{metrics.get('mean_phie_pay', 0.0)*100.0:.1f} %", body_style)],
        [Paragraph("Mean Water Saturation in Pay Zone", body_style), Paragraph(f"{metrics.get('mean_sw_pay', 0.0)*100.0:.1f} %", body_style)],
    ]
    t2 = Table(metrics_data, colWidths=[250, 250])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t2)
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("<i>This evaluation report is mathematically reproducible and generated directly from SQLite storage records.</i>", body_style))
    
    doc.build(story)
    buffer.seek(0)
    
    well_slug = str(well.get("well_name", "Well")).replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Elogant_Report_{well_slug}.pdf"}
    )
