import numpy as np
import pandas as pd

# ==========================================
# 1. Volume of Clay (VCL) Functions
# ==========================================

def vclgr(gr_log, gr_clean, gr_clay, correction=None):
    """Calculate VCL from Gamma Ray."""
    denom = gr_clay - gr_clean
    if denom == 0:
        return 0.0
    
    # Linear Gamma Ray Index
    igr = (gr_log - gr_clean) / denom
    igr = np.clip(igr, 0.0, 1.0)
    
    if correction == "young":
        return np.clip(0.083 * (2**(3.7 * igr) - 1), 0.0, 1.0)
    elif correction == "older":
        return np.clip(0.33 * (2**(2 * igr) - 1), 0.0, 1.0)
    elif correction == "clavier":
        return np.clip(1.7 - (3.38 - (igr + 0.7)**2)**0.5, 0.0, 1.0)
    elif correction == "steiber":
        return np.clip(0.5 * igr / (1.5 - igr), 0.0, 1.0)
    else:
        return igr

def vclsp(sp_log, sp_clean, sp_clay):
    """Calculate VCL from Spontaneous Potential (SP)."""
    denom = sp_clay - sp_clean
    if denom == 0:
        return 0.0
    vcl = (sp_log - sp_clean) / denom
    return np.clip(vcl, 0.0, 1.0)

def vclrt(rt_log, rt_clean, rt_clay):
    """Calculate VCL from Resistivity (Rt)."""
    denom = rt_clean - rt_clay
    if denom == 0:
        return 0.0
    vrt = (rt_clay / rt_log) * (rt_clean - rt_log) / denom
    if rt_log > 2 * rt_clay:
        vcl = 0.5 * (2 * vrt)**(0.67 * (vrt + 1))
    else:
        vcl = vrt
    return np.clip(vcl, 0.0, 1.0)

def vclnd(neut_log, den_log, neut_clean1, den_clean1, neut_clean2, den_clean2, neut_clay, den_clay):
    """Calculate VCL from Neutron-Density crossover."""
    term1 = (den_clean2 - den_clean1) * (neut_log - neut_clean1) - (den_log - den_clean1) * (neut_clean2 - neut_clean1)
    term2 = (den_clean2 - den_clean1) * (neut_clay - neut_clean1) - (den_clay - den_clean1) * (neut_clean2 - neut_clean1)
    if term2 == 0:
        return 0.0
    vcl = term1 / term2
    return np.clip(vcl, 0.0, 1.0)

# ==========================================
# 2. Porosity (PHI) Functions
# ==========================================

def phis_w(dt_log, dt_ma, dt_fl, cp=1.0):
    """Willie Time Average Porosity."""
    denom = dt_fl - dt_ma
    if denom == 0:
        return 0.0
    return np.clip((dt_log - dt_ma) / denom / cp, 0.0, 1.0)

def phis_w_sh_corr(dt_log, dt_ma, dt_fl, cp, dt_sh, vcl):
    """Willie Time Average Porosity Shale Corrected."""
    phis = phis_w(dt_log, dt_ma, dt_fl, cp)
    phish = phis_w(dt_sh, dt_ma, dt_fl, cp)
    return np.clip(phis - vcl * phish, 0.0, 1.0)

def phis_rhg(dt_log, dt_ma, alpha=0.625):
    """Raymer-Hunt-Gardner (RHG) Porosity."""
    if dt_log == 0:
        return 0.0
    return np.clip(alpha * (dt_log - dt_ma) / dt_log, 0.0, 1.0)

def phis_rhg_sh_corr(dt_log, dt_ma, dt_sh, vcl, dt_fl=188.0):
    """RHG Porosity Shale Corrected."""
    alpha = 0.625
    phis = phis_rhg(dt_log, dt_ma, alpha)
    phish = phis_rhg(dt_sh, dt_ma, alpha)
    return np.clip(phis - vcl * phish, 0.0, 1.0)

def phid(den_log, den_ma, den_fl, den_sh, vcl):
    """Density Porosity (Total)."""
    denom = den_ma - den_fl
    if denom == 0:
        return 0.0
    return np.clip((den_ma - den_log) / denom, 0.0, 1.0)

def phid_sh_corr(den_log, den_ma, den_fl, den_sh, vcl):
    """Density Porosity Shale Corrected (Effective)."""
    denom = den_ma - den_fl
    if denom == 0:
        return 0.0
    phid_total = (den_ma - den_log) / denom
    phid_sh = (den_ma - den_sh) / denom
    return np.clip(phid_total - vcl * phid_sh, 0.0, 1.0)

def phin_sh_corr(neut, neut_sh, vcl):
    """Neutron Porosity Shale Corrected (Effective)."""
    # Force decimal format
    nphi = neut if neut < 1.0 else neut / 100.0
    nphi_sh = neut_sh if neut_sh < 1.0 else neut_sh / 100.0
    return np.clip(nphi - vcl * nphi_sh, 0.0, 1.0)

def phixnd(phinshc, phidshc):
    """Effective Density-Neutron Porosity (Crossplot Combination)."""
    p1 = max(0.0, phinshc)
    p2 = max(0.0, phidshc)
    return np.sqrt((p1**2 + p2**2) / 2.0)

# ==========================================
# 3. Water Saturation (Sw) Functions
# ==========================================

def sw_archie(rw, rt, phie, a, m, n):
    """Archie Water Saturation."""
    if phie <= 0.001 or rt <= 0.001:
        return 1.0
    f = a / (phie ** m)
    sw = (f * rw / rt) ** (1.0 / n)
    return np.clip(sw, 0.0, 1.0)

# ==========================================
# 4. Net Pay calculations
# ==========================================

def calculate_net_pay(df, depth_col, vcl_col, phie_col, sw_col, vcl_cutoff, phie_cutoff, sw_cutoff):
    """Calculate Net Rock, Net Reservoir, Net Pay and NTG."""
    if len(df) == 0:
        return {
            "gross_thickness": 0.0, "net_sand": 0.0, "net_reservoir": 0.0, "net_pay": 0.0, "ntg": 0.0,
            "mean_phie_pay": 0.0, "mean_sw_pay": 0.0, "mean_vcl_pay": 0.0,
            "flags": {"sand": [], "reservoir": [], "pay": []}
        }
    
    depths = df[depth_col].values
    steps = np.diff(depths)
    if len(steps) > 0:
        steps = np.append(steps, steps[-1])
    else:
        steps = np.array([0.0])
    
    steps = np.abs(steps)
    
    is_sand = df[vcl_col] < vcl_cutoff
    is_reservoir = is_sand & (df[phie_col] >= phie_cutoff)
    is_pay = is_reservoir & (df[sw_col] <= sw_cutoff)
    
    gross_thickness = np.sum(steps)
    net_sand = np.sum(steps * is_sand)
    net_reservoir = np.sum(steps * is_reservoir)
    net_pay = np.sum(steps * is_pay)
    
    ntg = net_pay / gross_thickness if gross_thickness > 0 else 0.0
    
    pay_zone = df[is_pay]
    if len(pay_zone) > 0:
        mean_phie_pay = pay_zone[phie_col].mean()
        mean_sw_pay = pay_zone[sw_col].mean()
        mean_vcl_pay = pay_zone[vcl_col].mean()
    else:
        mean_phie_pay = 0.0
        mean_sw_pay = 0.0
        mean_vcl_pay = 0.0
        
    return {
        "gross_thickness": float(gross_thickness),
        "net_sand": float(net_sand),
        "net_reservoir": float(net_reservoir),
        "net_pay": float(net_pay),
        "ntg": float(ntg),
        "mean_phie_pay": float(mean_phie_pay),
        "mean_sw_pay": float(mean_sw_pay),
        "mean_vcl_pay": float(mean_vcl_pay),
        "flags": {
            "sand": is_sand.astype(int).tolist(),
            "reservoir": is_reservoir.astype(int).tolist(),
            "pay": is_pay.astype(int).tolist()
        }
    }
