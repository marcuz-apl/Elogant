import os
import pandas as pd
import numpy as np
import lasio

def clean_json_val(val):
    """Recursively converts nan/inf to None to prevent JSON serialization errors."""
    if isinstance(val, dict):
        return {k: clean_json_val(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [clean_json_val(v) for v in val]
    elif isinstance(val, float):
        if np.isnan(val) or np.isinf(val):
            return None
        return val
    elif isinstance(val, dict) or isinstance(val, tuple):
        return [clean_json_val(v) for v in val]
    return val

def parse_las_file(filepath):
    """Parses a standard LAS log file and returns structured well metadata and records."""
    las = lasio.read(filepath, null_policy="none", engine="normal")
    df = las.df()
    
    # Check depth columns and make sure DEPT exists
    idx_name = df.index.name
    if idx_name and idx_name.upper() in ["DEPT", "DEPTH", "M__DEPTH"]:
        df = df.reset_index()
        df = df.rename(columns={df.columns[0]: "DEPT"})
    elif "DEPT" not in df.columns and "DEPTH" in df.columns:
        df = df.rename(columns={"DEPTH": "DEPT"})
    elif "DEPT" not in df.columns and "M__DEPTH" in df.columns:
        df = df.rename(columns={"M__DEPTH": "DEPT"})
    
    if "DEPT" not in df.columns:
        df = df.reset_index()
        df = df.rename(columns={df.columns[0]: "DEPT"})
        
    df_clean = df.where(pd.notnull(df), None)
    data = df_clean.to_dict(orient="records")
    
    # Extract metadata fields from LAS well section
    well = las.well
    well_name = well.get("WELL", {}).value or os.path.basename(filepath)
    field = well.get("FLD", {}).value or "Unknown Field"
    company = well.get("COMP", {}).value or "Unknown Company"
    start_depth = float(well.get("STRT", {}).value or df["DEPT"].min() or 0.0)
    stop_depth = float(well.get("STOP", {}).value or df["DEPT"].max() or 0.0)
    step = float(well.get("STEP", {}).value or 0.5)
    null_val = float(well.get("NULL", {}).value or -999.25)
    api = well.get("API", {}).value or "Unknown API"
    
    curves = []
    for curve in las.curves:
        if curve.mnemonic != "DEPT" and curve.mnemonic != "DEPTH":
            curves.append({
                "mnemonic": curve.mnemonic,
                "unit": curve.unit or "unit",
                "descr": curve.descr or f"{curve.mnemonic} Log Curve",
                "has_data": True
            })
            
    return {
        "summary": {
            "well_name": str(well_name).strip(),
            "field": str(field).strip(),
            "company": str(company).strip(),
            "start_depth": start_depth,
            "stop_depth": stop_depth,
            "step": step,
            "null_val": null_val,
            "api": str(api).strip()
        },
        "curves": curves,
        "data": data
    }

def parse_text_file(filepath):
    """Parses tab, comma, or space-delimited log files into Elogant schema."""
    df = None
    # Try tab, comma, space-delimited parsers
    for sep in [r"\s+", ",", "\t"]:
        try:
            df = pd.read_csv(filepath, sep=sep, engine="python")
            if len(df.columns) > 1:
                break
        except Exception:
            continue
            
    if df is None:
        raise ValueError("Could not parse text file layout. Ensure it is comma/tab/space delimited.")
        
    # Standardize depth column name
    for col in df.columns:
        if col.upper() in ["DEPT", "DEPTH", "M__DEPTH", "MD"]:
            df = df.rename(columns={col: "DEPT"})
            break
            
    if "DEPT" not in df.columns:
        df = df.reset_index()
        df = df.rename(columns={df.columns[0]: "DEPT"})
        
    df_clean = df.where(pd.notnull(df), None)
    data = df_clean.to_dict(orient="records")
    
    start_depth = float(df["DEPT"].min() or 0.0)
    stop_depth = float(df["DEPT"].max() or 0.0)
    diffs = df["DEPT"].diff().dropna()
    step = float(diffs.abs().mean() if len(diffs) > 0 else 0.5)
    
    curves = []
    for col in df.columns:
        if col != "DEPT":
            curves.append({
                "mnemonic": col,
                "unit": "unit",
                "descr": f"{col} ASCII Log",
                "has_data": True
            })
            
    return {
        "summary": {
            "well_name": os.path.basename(filepath),
            "field": "Unknown Field",
            "company": "Unknown Company",
            "start_depth": start_depth,
            "stop_depth": stop_depth,
            "step": step,
            "null_val": -999.25,
            "api": "Unknown API"
        },
        "curves": curves,
        "data": data
    }
