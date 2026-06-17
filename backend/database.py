import os
import sqlite3
import pandas as pd
import numpy as np

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/elogant.db"))

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    try:
        # 1. Wells table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS wells (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            well_name TEXT,
            field TEXT,
            company TEXT,
            start_depth REAL,
            stop_depth REAL,
            step REAL,
            null_val REAL,
            api_uwi TEXT
        );
        """)
        
        # 2. Well curves table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS well_curves (
            well_id INTEGER,
            depth REAL,
            curve_name TEXT,
            value REAL,
            PRIMARY KEY (well_id, depth, curve_name),
            FOREIGN KEY (well_id) REFERENCES wells(id) ON DELETE CASCADE
        );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_well_curves_lookup ON well_curves(well_id, curve_name);")
        
        # 3. Scenarios table
        conn.execute("""
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            well_id INTEGER,
            name TEXT,
            folder TEXT DEFAULT 'Uncategorized',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            gr_clean REAL,
            gr_clay REAL,
            vcl_gr_correction TEXT,
            sp_clean REAL,
            sp_clay REAL,
            rt_clean REAL,
            rt_clay REAL,
            den_ma REAL,
            den_fl REAL,
            den_sh REAL,
            phin_sh REAL,
            dt_ma REAL,
            dt_fl REAL,
            dt_sh REAL,
            alpha REAL,
            porosity_method TEXT,
            rw REAL,
            a REAL,
            m REAL,
            n REAL,
            vcl_cutoff REAL,
            phie_cutoff REAL,
            sw_cutoff REAL,
            FOREIGN KEY (well_id) REFERENCES wells(id) ON DELETE CASCADE
        );
        """)
        conn.commit()
    finally:
        conn.close()

def add_well(filename, well_name, field, company, start_depth, stop_depth, step, null_val, api_uwi):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO wells (filename, well_name, field, company, start_depth, stop_depth, step, null_val, api_uwi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                well_name=excluded.well_name,
                field=excluded.field,
                company=excluded.company,
                start_depth=excluded.start_depth,
                stop_depth=excluded.stop_depth,
                step=excluded.step,
                null_val=excluded.null_val,
                api_uwi=excluded.api_uwi
            """,
            (filename, well_name, field, company, start_depth, stop_depth, step, null_val, api_uwi)
        )
        cursor.execute("SELECT id FROM wells WHERE filename = ?", (filename,))
        well_id = cursor.fetchone()[0]
        conn.commit()
        return well_id
    finally:
        conn.close()

def save_well_curves(well_id, df):
    if "DEPT" not in df.columns and "DEPTH" in df.columns:
        df = df.rename(columns={"DEPTH": "DEPT"})
    if "DEPT" not in df.columns:
        raise ValueError("DataFrame must contain a depth column named 'DEPT'")
        
    conn = get_db_connection()
    try:
        conn.execute("BEGIN TRANSACTION;")
        # Preserve calculated columns if they exist
        conn.execute(
            """
            DELETE FROM well_curves 
            WHERE well_id = ? 
              AND curve_name NOT IN ('VCL','PHIE','SW','BVW','matrix','PAY_FLAG','RESERVOIR_FLAG','SAND_FLAG')
            """,
            (well_id,)
        )
        
        df_long = df.melt(id_vars=['DEPT'], var_name='curve_name', value_name='value')
        df_long = df_long.dropna(subset=['value'])
        
        data = [
            (well_id, float(depth), str(name), float(val))
            for depth, name, val in df_long[['DEPT', 'curve_name', 'value']].itertuples(index=False, name=None)
        ]
        
        conn.executemany(
            "INSERT OR REPLACE INTO well_curves (well_id, depth, curve_name, value) VALUES (?, ?, ?, ?)",
            data
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def update_well_calculated_curves(well_id, calculated_df):
    if "DEPT" not in calculated_df.columns:
        raise ValueError("DataFrame must contain a 'DEPT' column")
        
    conn = get_db_connection()
    try:
        conn.execute("BEGIN TRANSACTION;")
        cols = [c for c in calculated_df.columns if c != "DEPT"]
        placeholders = ",".join("?" for _ in cols)
        query = f"DELETE FROM well_curves WHERE well_id = ? AND curve_name IN ({placeholders})"
        conn.execute(query, [well_id] + cols)
        
        df_long = calculated_df.melt(id_vars=['DEPT'], var_name='curve_name', value_name='value')
        df_long = df_long.dropna(subset=['value'])
        
        data = [
            (well_id, float(depth), str(name), float(val))
            for depth, name, val in df_long[['DEPT', 'curve_name', 'value']].itertuples(index=False, name=None)
        ]
        
        conn.executemany(
            "INSERT OR REPLACE INTO well_curves (well_id, depth, curve_name, value) VALUES (?, ?, ?, ?)",
            data
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_well_curves_df(well_id):
    conn = get_db_connection()
    try:
        query = "SELECT depth, curve_name, value FROM well_curves WHERE well_id = ? ORDER BY depth"
        df_long = pd.read_sql_query(query, conn, params=[well_id])
        if df_long.empty:
            return pd.DataFrame(columns=["DEPT"])
            
        df_wide = df_long.pivot(index='depth', columns='curve_name', values='value').reset_index()
        df_wide = df_wide.rename(columns={"depth": "DEPT"})
        df_wide = df_wide.sort_values(by="DEPT").reset_index(drop=True)
        return df_wide
    finally:
        conn.close()

def get_wells_list():
    conn = get_db_connection()
    try:
        query = "SELECT id, filename, well_name, field, company, start_depth, stop_depth, step, api_uwi FROM wells ORDER BY well_name"
        cursor = conn.execute(query)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_well(well_id):
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM wells WHERE id = ?", (well_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_well_by_filename(filename):
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM wells WHERE filename = ?", (filename,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_well(well_id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM wells WHERE id = ?", (well_id,))
        conn.commit()
    finally:
        conn.close()

def save_scenario(well_id, name, folder, settings):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if scenario with this name and well already exists
        cursor.execute("SELECT id FROM scenarios WHERE well_id = ? AND name = ?", (well_id, name))
        row = cursor.fetchone()
        
        if row:
            # Update existing scenario
            scenario_id = row[0]
            cursor.execute(
                """
                UPDATE scenarios SET
                    folder=?, updated_at=CURRENT_TIMESTAMP, gr_clean=?, gr_clay=?, vcl_gr_correction=?,
                    sp_clean=?, sp_clay=?, rt_clean=?, rt_clay=?, den_ma=?, den_fl=?, den_sh=?,
                    phin_sh=?, dt_ma=?, dt_fl=?, dt_sh=?, alpha=?, porosity_method=?, rw=?,
                    a=?, m=?, n=?, vcl_cutoff=?, phie_cutoff=?, sw_cutoff=?
                WHERE id = ?
                """,
                (
                    folder, settings.get("gr_clean", 40.0), settings.get("gr_clay", 135.0), settings.get("vcl_gr_correction", "linear"),
                    settings.get("sp_clean", -60.0), settings.get("sp_clay", 2.0), settings.get("rt_clean", 2.0), settings.get("rt_clay", 2.0),
                    settings.get("den_ma", 2.65), settings.get("den_fl", 1.10), settings.get("den_sh", 2.40), settings.get("phin_sh", 45.0),
                    settings.get("dt_ma", 55.5), settings.get("dt_fl", 188.0), settings.get("dt_sh", 90.0), settings.get("alpha", 0.625),
                    settings.get("porosity_method", "density_neutron"), settings.get("rw", 0.45), settings.get("a", 1.0), settings.get("m", 1.8),
                    settings.get("n", 2.0), settings.get("vcl_cutoff", 0.4), settings.get("phie_cutoff", 0.1), settings.get("sw_cutoff", 0.5),
                    scenario_id
                )
            )
        else:
            # Insert new scenario
            cursor.execute(
                """
                INSERT INTO scenarios (
                    well_id, name, folder, gr_clean, gr_clay, vcl_gr_correction,
                    sp_clean, sp_clay, rt_clean, rt_clay, den_ma, den_fl, den_sh,
                    phin_sh, dt_ma, dt_fl, dt_sh, alpha, porosity_method, rw,
                    a, m, n, vcl_cutoff, phie_cutoff, sw_cutoff
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    well_id, name, folder, settings.get("gr_clean", 40.0), settings.get("gr_clay", 135.0), settings.get("vcl_gr_correction", "linear"),
                    settings.get("sp_clean", -60.0), settings.get("sp_clay", 2.0), settings.get("rt_clean", 2.0), settings.get("rt_clay", 2.0),
                    settings.get("den_ma", 2.65), settings.get("den_fl", 1.10), settings.get("den_sh", 2.40), settings.get("phin_sh", 45.0),
                    settings.get("dt_ma", 55.5), settings.get("dt_fl", 188.0), settings.get("dt_sh", 90.0), settings.get("alpha", 0.625),
                    settings.get("porosity_method", "density_neutron"), settings.get("rw", 0.45), settings.get("a", 1.0), settings.get("m", 1.8),
                    settings.get("n", 2.0), settings.get("vcl_cutoff", 0.4), settings.get("phie_cutoff", 0.1), settings.get("sw_cutoff", 0.5)
                )
            )
            scenario_id = cursor.lastrowid
        conn.commit()
        return scenario_id
    finally:
        conn.close()

def get_scenarios_list(well_id=None):
    conn = get_db_connection()
    try:
        if well_id is not None:
            query = "SELECT * FROM scenarios WHERE well_id = ? ORDER BY updated_at DESC"
            cursor = conn.execute(query, (well_id,))
        else:
            query = "SELECT * FROM scenarios ORDER BY updated_at DESC"
            cursor = conn.execute(query)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_scenario(scenario_id):
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def delete_scenario(scenario_id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
        conn.commit()
    finally:
        conn.close()
