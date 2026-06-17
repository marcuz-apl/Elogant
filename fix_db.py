import sqlite3
import os

from backend.parser import parse_las_file, parse_text_file

conn = sqlite3.connect("data/elogant.db")
try:
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename FROM wells")
    wells = cursor.fetchall()
    
    for well_id, filename in wells:
        filepath = os.path.join("data", filename)
        if os.path.exists(filepath):
            if filename.lower().endswith(".las"):
                parsed = parse_las_file(filepath)
            else:
                parsed = parse_text_file(filepath)
            depth_unit = parsed["summary"].get("depth_unit", "ft")
            cursor.execute("UPDATE wells SET depth_unit = ? WHERE id = ?", (depth_unit, well_id))
            print(f"Updated {filename} with depth_unit={depth_unit}")
    
    conn.commit()
    print("Database depth_unit migration completed successfully.")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
