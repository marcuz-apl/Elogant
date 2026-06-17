'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, Save, FolderPlus, Trash2, ArrowLeft,
  Upload, FileSpreadsheet, FileDown, Layers, CheckCircle2, ChevronRight, 
  Sliders, Settings, Wrench, BarChart4, AlertCircle, Copy, Cpu
} from 'lucide-react';

const API_URL = 'http://localhost:8000';

export default function Dashboard() {


  // Well lists state
  const [wellsList, setWellsList] = useState<any[]>([]);
  const [activeWellFilename, setActiveWellFilename] = useState<string>('-- Select Well --');
  const [wellData, setWellData] = useState<any>(null);
  
  // Scenarios state
  const [scenariosList, setScenariosList] = useState<any[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  const [scenarioName, setScenarioName] = useState<string>('Base Case');
  const [scenarioFolder, setScenarioFolder] = useState<string>('Interpretation Cases');

  // Mode toggles
  const [wrangleMode, setWrangleMode] = useState<boolean>(false);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);

  // Status & Loaders
  const [isDataLoaderOpen, setIsDataLoaderOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isWrangling, setIsWrangling] = useState<boolean>(false);
  const [isPdfExporting, setIsPdfExporting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' | null }>({ text: '', type: null });

  // Calculation parameters
  const [grClean, setGrClean] = useState<number>(40.0);
  const [grClay, setGrClay] = useState<number>(135.0);
  const [vclGrCorrection, setVclGrCorrection] = useState<string>('linear');
  
  const [spClean, setSpClean] = useState<number>(-60.0);
  const [spClay, setSpClay] = useState<number>(2.0);
  
  const [rtClean, setRtClean] = useState<number>(2.0);
  const [rtClay, setRtClay] = useState<number>(2.0);
  
  const [porosityMethod, setPorosityMethod] = useState<string>('density_neutron');
  const [denMa, setDenMa] = useState<number>(2.65);
  const [denFl, setDenFl] = useState<number>(1.10);
  const [denSh, setDenSh] = useState<number>(2.40);
  const [phinSh, setPhinSh] = useState<number>(45.0);
  const [dtMa, setDtMa] = useState<number>(55.5);
  const [dtFl, setDtFl] = useState<number>(188.0);
  const [dtSh, setDtSh] = useState<number>(90.0);
  const [alpha, setAlpha] = useState<number>(0.625);

  const [rw, setRw] = useState<number>(0.45);
  const [aConst, setAConst] = useState<number>(1.0);
  const [mConst, setMConst] = useState<number>(1.8);
  const [nConst, setNConst] = useState<number>(2.0);

  const [vclCutoff, setVclCutoff] = useState<number>(0.40);
  const [phieCutoff, setPhieCutoff] = useState<number>(0.10);
  const [swCutoff, setSwCutoff] = useState<number>(0.50);

  // Result state
  const [calculatedData, setCalculatedData] = useState<any[]>([]);
  const [calculatedMetrics, setCalculatedMetrics] = useState<any>(null);

  // Wrangle tool states
  const [wrangleCurve, setWrangleCurve] = useState<string>('');
  const [despikeWindow, setDespikeWindow] = useState<number>(5);
  const [cleanseMethod, setCleanseMethod] = useState<string>('both');
  const [cleanseMin, setCleanseMin] = useState<string>('');
  const [cleanseMax, setCleanseMax] = useState<string>('');
  const [mergeSecondary, setMergeSecondary] = useState<string>('');
  const [mergeOutput, setMergeOutput] = useState<string>('');
  const [mergeStrategy, setMergeStrategy] = useState<string>('prefer_primary');

  // ML Synthesis States
  const [mlTrainWell, setMlTrainWell] = useState<string>('');
  const [mlDestWell, setMlDestWell] = useState<string>('');
  const [mlTarget, setMlTarget] = useState<string>('DT');
  const [mlModelType, setMlModelType] = useState<string>('xgboost');
  const [mlFeatures, setMlFeatures] = useState<string[]>(['GR', 'CALI', 'NPHI', 'RHOB']);
  const [mlMae, setMlMae] = useState<number | null>(null);



  // Load well registry & scenarios on mount
  useEffect(() => {
    fetchWellsList();
    fetchScenarios();
  }, []);

  // Recalculate curves when active well or parameters change
  useEffect(() => {
    if (wellData) {
      runCalculations();
    }
  }, [
    activeWellFilename, grClean, grClay, vclGrCorrection, spClean, spClay, rtClean, rtClay,
    porosityMethod, denMa, denFl, denSh, phinSh, dtMa, dtFl, dtSh, alpha, rw, aConst, mConst, nConst,
    vclCutoff, phieCutoff, swCutoff
  ]);

  const showStatus = (text: string, type: 'info' | 'success' | 'error') => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg({ text: '', type: null });
    }, 4000);
  };

  const fetchWellsList = async () => {
    try {
      const res = await fetch(`${API_URL}/api/list-files`);
      if (res.ok) {
        const data = await res.json();
        setWellsList(data.wells || []);
        if (data.files && data.files.length > 0 && activeWellFilename === '-- Select Well --') {
          // don't auto-load first to follow the "Central area starts with Data Loading" rule
        }
      }
    } catch (err) {
      showStatus('Failed to connect to backend FastAPI server.', 'error');
    }
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenariosList(data.scenarios || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadWell = async (filename: string) => {
    if (filename === '-- Select Well --') {
      setWellData(null);
      setCalculatedData([]);
      setCalculatedMetrics(null);
      setActiveWellFilename('-- Select Well --');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/load-file?filename=${filename}`);
      if (res.ok) {
        const data = await res.json();
        setWellData(data);
        setActiveWellFilename(filename);
        if (data.curves && data.curves.length > 0) {
          setWrangleCurve(data.curves[0].mnemonic);
          setMergeSecondary(data.curves[1]?.mnemonic || data.curves[0].mnemonic);
          setMergeOutput(`${data.curves[0].mnemonic}_MERGED`);
        }
        showStatus(`Successfully loaded logs for well: ${data.summary.well_name}`, 'success');
        setIsDataLoaderOpen(false);
      } else {
        showStatus('Failed to load log curves from database.', 'error');
      }
    } catch (err) {
      showStatus('Connection failure.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/upload-file`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setWellData(data);
        setActiveWellFilename(file.name);
        await fetchWellsList();
        showStatus(`Successfully parsed and saved ${file.name} to SQLite.`, 'success');
        setIsDataLoaderOpen(false);
      } else {
        const errText = await res.text();
        showStatus(`Parse failure: ${errText}`, 'error');
      }
    } catch (err) {
      showStatus('Network uploader error.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const runCalculations = async () => {
    if (!wellData) return;
    setIsCalculating(true);

    const curvesList = wellData.curves.map((c: any) => c.mnemonic);
    const payload = {
      well_id: wellData.well_id,
      data: wellData.data,
      depth_col: 'DEPT',
      gr_col: curvesList.includes('GR') ? 'GR' : (curvesList.includes('GR_LOG') ? 'GR_LOG' : 'DEPT'),
      sp_col: curvesList.includes('SP') ? 'SP' : 'DEPT',
      rt_col: curvesList.includes('ILD') ? 'ILD' : (curvesList.includes('LLD') ? 'LLD' : 'DEPT'),
      neut_col: curvesList.includes('NPHI') ? 'NPHI' : 'DEPT',
      den_col: curvesList.includes('RHOB') ? 'RHOB' : 'DEPT',
      dt_col: curvesList.includes('DT') ? 'DT' : 'DEPT',
      
      gr_clean: grClean,
      gr_clay: grClay,
      vcl_gr_correction: vclGrCorrection,
      sp_clean: spClean,
      sp_clay: spClay,
      rt_clean: rtClean,
      rt_clay: rtClay,
      
      porosity_method: porosityMethod,
      den_ma: denMa,
      den_fl: denFl,
      den_sh: denSh,
      phin_sh: phinSh,
      dt_ma: dtMa,
      dt_fl: dtFl,
      dt_sh: dtSh,
      alpha: alpha,
      
      rw: rw,
      a: aConst,
      m: mConst,
      n: nConst,
      
      vcl_cutoff: vclCutoff,
      phie_cutoff: phieCutoff,
      sw_cutoff: swCutoff
    };

    // Remove fallback defaults
    const cols = ['gr_col', 'sp_col', 'rt_col', 'neut_col', 'den_col', 'dt_col'];
    cols.forEach(k => {
      if (payload[k as keyof typeof payload] === 'DEPT') {
        delete (payload as any)[k];
      }
    });

    try {
      const res = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setCalculatedData(data.data || []);
        setCalculatedMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!wellData) {
      showStatus('Please load a well log first.', 'error');
      return;
    }

    try {
      const payload = {
        well_id: wellData.well_id,
        name: scenarioName,
        folder: scenarioFolder,
        settings: {
          gr_clean: grClean,
          gr_clay: grClay,
          vcl_gr_correction: vclGrCorrection,
          sp_clean: spClean,
          sp_clay: spClay,
          rt_clean: rtClean,
          rt_clay: rtClay,
          porosity_method: porosityMethod,
          den_ma: denMa,
          den_fl: denFl,
          den_sh: denSh,
          phin_sh: phinSh,
          dt_ma: dtMa,
          dt_fl: dtFl,
          dt_sh: dtSh,
          alpha: alpha,
          rw: rw,
          a: aConst,
          m: mConst,
          n: nConst,
          vcl_cutoff: vclCutoff,
          phie_cutoff: phieCutoff,
          sw_cutoff: swCutoff
        }
      };

      const res = await fetch(`${API_URL}/api/save-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showStatus(`Case '${scenarioName}' saved to database.`, 'success');
        fetchScenarios();
      } else {
        showStatus('Failed to write case settings.', 'error');
      }
    } catch (err) {
      showStatus('Failed to write scenario settings.', 'error');
    }
  };

  const loadScenarioSettings = (sc: any) => {
    setGrClean(sc.gr_clean);
    setGrClay(sc.gr_clay);
    setVclGrCorrection(sc.vcl_gr_correction);
    setSpClean(sc.sp_clean);
    setSpClay(sc.sp_clay);
    setRtClean(sc.rt_clean);
    setRtClay(sc.rt_clay);
    setPorosityMethod(sc.porosity_method);
    setDenMa(sc.den_ma);
    setDenFl(sc.den_fl);
    setDenSh(sc.den_sh);
    setPhinSh(sc.phin_sh);
    setDtMa(sc.dt_ma);
    setDtFl(sc.dt_fl);
    setDtSh(sc.dt_sh);
    setAlpha(sc.alpha);
    setRw(sc.rw);
    setAConst(sc.a);
    setMConst(sc.m);
    setNConst(sc.n);
    setVclCutoff(sc.vcl_cutoff);
    setPhieCutoff(sc.phie_cutoff);
    setSwCutoff(sc.sw_cutoff);
    
    setScenarioName(sc.name);
    setScenarioFolder(sc.folder);
    setActiveScenarioId(sc.id);

    // Load matching well if different
    const matchingWell = wellsList.find(w => w.id === sc.well_id);
    if (matchingWell && matchingWell.filename !== activeWellFilename) {
      loadWell(matchingWell.filename);
    }
    showStatus(`Loaded case: ${sc.name}`, 'success');
  };

  const handleDeleteScenario = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/delete-scenario/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showStatus('Deleted case configuration.', 'info');
        fetchScenarios();
        if (activeScenarioId === id) {
          setActiveScenarioId(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Wrangle operations api calls
  const applyDespike = async () => {
    if (!wellData) return;
    setIsWrangling(true);
    try {
      const res = await fetch(`${API_URL}/api/wrangle/despike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          well_id: wellData.well_id,
          data: wellData.data,
          column: wrangleCurve,
          window_size: despikeWindow
        })
      });
      if (res.ok) {
        const result = await res.json();
        setWellData({ ...wellData, data: result.data });
        showStatus(`Outliers removed from ${wrangleCurve}.`, 'success');
      }
    } catch (err) {
      showStatus('Outlier filter execution error.', 'error');
    } finally {
      setIsWrangling(false);
    }
  };

  const applyCleansing = async () => {
    if (!wellData) return;
    setIsWrangling(true);
    try {
      const res = await fetch(`${API_URL}/api/wrangle/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          well_id: wellData.well_id,
          data: wellData.data,
          column: wrangleCurve,
          method: cleanseMethod,
          min_val: cleanseMin !== '' ? parseFloat(cleanseMin) : null,
          max_val: cleanseMax !== '' ? parseFloat(cleanseMax) : null
        })
      });
      if (res.ok) {
        const result = await res.json();
        setWellData({ ...wellData, data: result.data });
        showStatus(`Logs curve ${wrangleCurve} cleansed and clamped.`, 'success');
      }
    } catch (err) {
      showStatus('Cleansing execution error.', 'error');
    } finally {
      setIsWrangling(false);
    }
  };

  const applyMerge = async () => {
    if (!wellData) return;
    setIsWrangling(true);
    try {
      const res = await fetch(`${API_URL}/api/wrangle/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          well_id: wellData.well_id,
          data: wellData.data,
          primary_col: wrangleCurve,
          secondary_col: mergeSecondary,
          output_col: mergeOutput,
          merge_strategy: mergeStrategy
        })
      });
      if (res.ok) {
        const result = await res.json();
        // Add new curve description if not present
        const curves = [...wellData.curves];
        if (!curves.some(c => c.mnemonic === mergeOutput)) {
          curves.push({ mnemonic: mergeOutput, unit: 'unit', descr: 'Merged Overlay Logs', has_data: true });
        }
        setWellData({ ...wellData, curves, data: result.data });
        showStatus(`Log curves overlay written to ${mergeOutput}.`, 'success');
      }
    } catch (err) {
      showStatus('Logs overlay merge error.', 'error');
    } finally {
      setIsWrangling(false);
    }
  };

  // ML Synthesis call
  const runMLSynthesis = async () => {
    if (!mlTrainWell || !mlDestWell) {
      showStatus('Please specify training reference well and target destination well.', 'error');
      return;
    }

    setIsWrangling(true);
    try {
      const trainRes = await fetch(`${API_URL}/api/load-file?filename=${mlTrainWell}`);
      const destRes = await fetch(`${API_URL}/api/load-file?filename=${mlDestWell}`);
      
      if (trainRes.ok && destRes.ok) {
        const trainObj = await trainRes.json();
        const destObj = await destRes.json();

        const res = await fetch(`${API_URL}/api/ml/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            train_well_id: trainObj.well_id,
            predict_well_id: destObj.well_id,
            train_data: trainObj.data,
            predict_data: destObj.data,
            features: mlFeatures,
            target: mlTarget,
            model_type: mlModelType
          })
        });

        if (res.ok) {
          const result = await res.json();
          setMlMae(result.mae);
          showStatus(`ML Regression synthesis complete! MAE: ${result.mae.toFixed(4)}`, 'success');
          
          if (mlDestWell === activeWellFilename) {
            // Update active well data cache
            const curves = [...wellData.curves];
            const predColName = result.predicted_col;
            if (!curves.some(c => c.mnemonic === predColName)) {
              curves.push({ mnemonic: predColName, unit: 'us/ft', descr: 'Synthesised missing transit log', has_data: true });
            }
            setWellData({ ...wellData, curves, data: result.data });
          }
        } else {
          showStatus('ML synthesizer failed during fit process.', 'error');
        }
      }
    } catch (err) {
      showStatus('ML server connection failure.', 'error');
    } finally {
      setIsWrangling(false);
    }
  };

  // Export PDF Report
  const downloadPdfReport = async () => {
    if (!wellData || !calculatedMetrics) return;
    setIsPdfExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          well: {
            well_name: wellData.summary.well_name,
            field: wellData.summary.field,
            company: wellData.summary.company,
            api: wellData.summary.api,
            start_depth: wellData.summary.start_depth,
            stop_depth: wellData.summary.stop_depth
          },
          metrics: {
            gross_thickness: calculatedMetrics.gross_thickness,
            net_sand: calculatedMetrics.net_sand,
            net_reservoir: calculatedMetrics.net_reservoir,
            net_pay: calculatedMetrics.net_pay,
            ntg: calculatedMetrics.ntg,
            mean_vcl_pay: calculatedMetrics.mean_vcl_pay,
            mean_phie_pay: calculatedMetrics.mean_phie_pay,
            mean_sw_pay: calculatedMetrics.mean_sw_pay
          }
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Elogant_Report_${wellData.summary.well_name.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showStatus('PDF Report downloaded successfully.', 'success');
      }
    } catch (err) {
      showStatus('Failed to generate PDF Report.', 'error');
    } finally {
      setIsPdfExporting(false);
    }
  };

  // Export raw CSV
  const downloadCsv = () => {
    if (calculatedData.length === 0) return;
    const headers = Object.keys(calculatedData[0]).join(',');
    const rows = calculatedData.map(row => 
      Object.values(row).map(v => v === null ? '' : v).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Elogant_Interpretation_${wellData.summary.well_name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Scenario Grouping (sidebar list)
  const groupedScenarios: { [key: string]: any[] } = {};
  scenariosList.forEach(sc => {
    const f = sc.folder || 'Uncategorized';
    if (!groupedScenarios[f]) groupedScenarios[f] = [];
    groupedScenarios[f].push(sc);
  });

  // Calculate SVG line paths for logs tracks
  const getSvgPath = (col: string, minVal: number, maxVal: number, width: number, height: number, logScale = false) => {
    if (calculatedData.length === 0) return '';
    const points: string[] = [];
    const minD = wellData.summary.start_depth;
    const maxD = wellData.summary.stop_depth;
    const deltaD = maxD - minD;

    // downsample to prevent rendering lag on massive datasets
    const stepSize = Math.max(1, Math.floor(calculatedData.length / 500));

    for (let i = 0; i < calculatedData.length; i += stepSize) {
      const row = calculatedData[i];
      const depth = row.DEPT;
      const val = row[col];

      if (val === null || val === undefined) continue;

      const y = ((depth - minD) / deltaD) * height;
      let x = 0;
      if (logScale) {
        const logMin = Math.log10(Math.max(0.01, minVal));
        const logMax = Math.log10(maxVal);
        const logVal = Math.log10(Math.max(0.01, val));
        x = ((logVal - logMin) / (logMax - logMin)) * width;
      } else {
        x = ((val - minVal) / (maxVal - minVal)) * width;
      }
      points.push(`${Math.max(0, Math.min(width, x))},${y}`);
    }

    return points.join(' ');
  };

  // Pickett plot points
  const getPickettPoints = (width: number, height: number) => {
    if (calculatedData.length === 0) return [];
    
    // Filter clean sand values for Pickett plot
    const cleanSands = calculatedData.filter(row => row.VCL < 0.15 && row.PHIE > 0.01 && row.ILD > 0.1);
    
    const minRt = Math.log10(0.1);
    const maxRt = Math.log10(1000.0);
    const minPhi = Math.log10(0.01);
    const maxPhi = Math.log10(0.5);

    const step = Math.max(1, Math.floor(cleanSands.length / 300));
    const outputPoints = [];

    for (let i = 0; i < cleanSands.length; i += step) {
      const row = cleanSands[i];
      const rt = Math.log10(row.ILD);
      const phi = Math.log10(row.PHIE);

      const cx = ((rt - minRt) / (maxRt - minRt)) * width;
      const cy = height - ((phi - minPhi) / (maxPhi - minPhi)) * height;
      
      outputPoints.push({
        cx: Math.max(0, Math.min(width, cx)),
        cy: Math.max(0, Math.min(height, cy)),
        vcl: row.VCL
      });
    }
    return outputPoints;
  };

  // Pickett Sw curves
  const getPickettSwLine = (sw: number, width: number, height: number) => {
    const phieGrid = [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.45];
    const points: string[] = [];

    const minRt = Math.log10(0.1);
    const maxRt = Math.log10(1000.0);
    const minPhi = Math.log10(0.01);
    const maxPhi = Math.log10(0.5);

    phieGrid.forEach(phie => {
      // Archie formula for Rt: Rt = (a * Rw) / (Sw^n * PHI^m)
      const rtVal = (aConst * rw) / (Math.pow(sw, nConst) * Math.pow(phie, mConst));
      
      const rt = Math.log10(rtVal);
      const phi = Math.log10(phie);

      const x = ((rt - minRt) / (maxRt - minRt)) * width;
      const y = height - ((phi - minPhi) / (maxPhi - minPhi)) * height;
      
      points.push(`${x},${y}`);
    });

    return points.join(' ');
  };

  // Extracted dynamically from the loaded well log
  const depthUnit = wellData?.summary?.depth_unit || wellData?.curves?.[0]?.unit || 'ft';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      
      {/* Well Metadata Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-card-border/20 bg-sidebar/80 shrink-0 z-40 relative">
        {/* Dynamic Well Metadata Banner */}
        <div className="flex items-center gap-6 text-[11px] text-text-secondary">
          {wellData ? (
            <>
              <div><span className="text-text-muted mr-1 font-bold">WELL:</span> {wellData.summary.well_name}</div>
              <div className="h-3 w-[1px] bg-card-border/30 hidden sm:block" />
              <div className="hidden sm:block"><span className="text-text-muted mr-1 font-bold">FIELD:</span> {wellData.summary.field}</div>
              <div className="h-3 w-[1px] bg-card-border/30 hidden md:block" />
              <div className="hidden md:block"><span className="text-text-muted mr-1 font-bold">API/UWI:</span> {wellData.summary.api}</div>
              <div className="h-3 w-[1px] bg-card-border/30 hidden lg:block" />
              <div className="hidden lg:block"><span className="text-text-muted mr-1 font-bold">DEPTHS:</span> {wellData.summary.start_depth} - {wellData.summary.stop_depth} {depthUnit}</div>
            </>
          ) : (
            <div className="text-text-muted italic">No well log dataset active in the current session workspace</div>
          )}
        </div>

        {/* Right side: status + actions */}
        <div className="flex items-center gap-3">
          {/* Status Message */}
          {statusMsg.text && (
            <div className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 border font-semibold animate-fade-in ${
              statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              statusMsg.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
              'bg-[#865be9]/10 border-[#865be9]/30 text-[#a78bfa]'
            }`}>
              {statusMsg.text}
            </div>
          )}
          
          <div className="flex items-center gap-1 text-[10px] text-text-muted border border-card-border/20 px-2 py-1 rounded-lg bg-input">
            <Cpu size={12} className="text-[#a78bfa] animate-pulse" />
            <span className="font-bold hidden sm:inline">Workspace Active</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        
        {/* Left Sidebar Case Manager */}
        <aside className="w-64 border-r border-card-border/30 bg-sidebar flex flex-col shrink-0">
          <div className="p-4 border-b border-card-border/20 shrink-0">
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-text-muted mb-3">Interpretation Controls</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-text-muted uppercase">Resolution</span>
                <select className="w-full text-xs bg-input border border-input-border p-1.5 rounded text-white outline-none">
                  <option value="0.50">Normal - 0.50</option>
                  <option value="0.25">High - 0.25</option>
                </select>
              </div>
              <button 
                onClick={runCalculations}
                disabled={!wellData || isCalculating}
                className="w-full mt-4 py-1 bg-[#865be9] hover:bg-[#7542e5] rounded text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <RefreshCw size={12} className={isCalculating ? 'animate-spin' : ''} />
                Run Engine
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-card-border/20 shrink-0">
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-text-muted mb-2">Case Manager</h2>
            <div className="flex flex-col gap-2.5">
              <input 
                type="text" 
                placeholder="Folder"
                value={scenarioFolder}
                onChange={e => setScenarioFolder(e.target.value)}
                className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
              />
              <input 
                type="text" 
                placeholder="Case Name"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
              />
              <button 
                onClick={handleSaveScenario}
                disabled={!wellData}
                className="w-full py-1.5 bg-gradient-to-r from-[#865be9] to-[#7542e5] text-white text-xs font-bold rounded flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Save size={14} />
                Save Case
              </button>
            </div>
          </div>

          {/* Historical Cases Grouped List */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-text-muted mb-2">Saved Cases</h2>
            {scenariosList.length === 0 ? (
              <div className="text-[11px] text-text-muted italic text-center py-6">No cases in SQLite DB</div>
            ) : (
              Object.keys(groupedScenarios).map(folder => (
                <div key={folder} className="mb-4">
                  <div className="text-[10px] font-bold text-text-muted mb-1.5 uppercase flex items-center gap-1">
                    📁 {folder}
                  </div>
                  <div className="flex flex-col gap-1 pl-2 border-l border-card-border/20">
                    {groupedScenarios[folder].map(sc => {
                      const wellObj = wellsList.find(w => w.id === sc.well_id);
                      return (
                        <div key={sc.id} className="group flex items-center justify-between text-xs p-1.5 hover:bg-[#1e1d24] rounded cursor-pointer">
                          <span 
                            onClick={() => loadScenarioSettings(sc)}
                            className={`flex-1 text-text-secondary truncate pr-2 hover:text-[#a78bfa] font-medium ${activeScenarioId === sc.id ? 'text-[#a78bfa] font-bold' : ''}`}
                          >
                            📄 {sc.name} <span className="text-[10px] text-text-muted">({wellObj?.well_name || 'Well'})</span>
                          </span>
                          <button 
                            onClick={() => handleDeleteScenario(sc.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-500 rounded transition-opacity"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Central Workspace display area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background p-6">
          
          {/* Data Loading Section (Always starts here or uploader dashboard) */}
          <section className={`mb-6 glass-panel rounded-xl transition-all ${isDataLoaderOpen ? 'p-6' : 'px-6 py-4'}`}>
            <div className={`flex items-center justify-between ${isDataLoaderOpen ? 'border-b border-card-border/30 pb-3 mb-4' : ''}`}>
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setIsDataLoaderOpen(!isDataLoaderOpen)}
              >
                <ChevronRight size={16} className={`text-text-muted transition-transform ${isDataLoaderOpen ? 'rotate-90' : 'group-hover:text-white'}`} />
                <Upload size={18} className="text-[#a78bfa]" />
                <h3 className="font-extrabold text-sm tracking-tight group-hover:text-[#a78bfa] transition-colors">Data Registry & Log Loader</h3>
              </div>
              
              {wellData && (
                <div className="flex items-center gap-4">
                  {!isDataLoaderOpen && (
                    <span className="text-xs text-[#a78bfa] font-bold bg-[#865be9]/10 px-2 py-1 rounded">
                      Active: {activeWellFilename}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary font-bold">Data Wrangle Mode:</span>
                  <div className="flex border border-card-border/30 rounded-lg overflow-hidden shrink-0">
                    <button 
                      onClick={() => setWrangleMode(true)}
                      className={`text-xs px-3 py-1 font-bold transition-all ${wrangleMode ? 'bg-[#865be9] text-white' : 'bg-[#1e1d24] text-text-secondary hover:text-white'}`}
                    >
                      ON
                    </button>
                    <button 
                      onClick={() => setWrangleMode(false)}
                      className={`text-xs px-3 py-1 font-bold transition-all ${!wrangleMode ? 'bg-[#865be9] text-white' : 'bg-[#1e1d24] text-text-secondary hover:text-white'}`}
                    >
                      OFF
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>

            {isDataLoaderOpen && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Dropdown database selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-extrabold text-text-muted uppercase">Select Well log from SQLite DB</label>
                <select 
                  value={activeWellFilename}
                  onChange={e => loadWell(e.target.value)}
                  className="w-full text-xs bg-input border border-input-border p-2.5 rounded text-white outline-none font-semibold cursor-pointer"
                >
                  <option value="-- Select Well --">-- Choose log file --</option>
                  {wellsList.map(well => (
                    <option key={well.id} value={well.filename}>{well.well_name} ({well.filename})</option>
                  ))}
                </select>
              </div>

              {/* Upload log uploader */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-extrabold text-text-muted uppercase">Upload LAS / ASCII Text log File</label>
                <label className="w-full flex items-center justify-center gap-2 border border-dashed border-[#865be9]/40 hover:border-[#865be9] p-2.5 rounded-lg text-xs font-bold text-[#a78bfa] hover:bg-[#865be9]/5 transition-all cursor-pointer">
                  <Upload size={14} />
                  Choose File (.las, .txt, .csv)
                  <input type="file" onChange={handleFileUpload} accept=".las,.LAS,.txt,.csv" className="hidden" />
                </label>
              </div>

              {/* Loader info metrics */}
              <div className="flex flex-col gap-2 text-xs text-text-secondary bg-[#1e1d24]/40 p-2.5 rounded-lg border border-card-border/10 justify-center">
                {wellData ? (
                  <>
                    <div><span className="text-text-muted font-bold">Available Curves:</span> {wellData.curves.map((c: any) => c.mnemonic).join(', ')}</div>
                    <div className="mt-1"><span className="text-text-muted font-bold">Log Depths count:</span> {wellData.data.length} intervals</div>
                  </>
                ) : (
                  <div className="italic text-text-muted text-center">No datasets currently loaded in memory</div>
                )}
              </div>
            </div>
            )}
          </section>

          {/* Conditional View panels */}
          {!wellData ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 glass-panel rounded-xl bg-[#1a1920]/40">
              <Layers size={48} className="text-[#a78bfa]/40 mb-3" />
              <h2 className="text-xl font-bold tracking-tight text-text-primary mb-1.5">Welcome to Elogant Workspace</h2>
              <p className="text-xs text-text-secondary text-center max-w-md">
                To begin processing log datasets, select one of the preloaded log templates (e.g. `WA1.LAS`) from the select menu above, or drop a custom petrophysical well file.
              </p>
            </div>
          ) : wrangleMode ? (
            /* ==========================================
               DATA WRANGLE VIEW 
               ========================================== */
            <section className="flex flex-col gap-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                
                {/* Outliers Filter & Cleansing limits */}
                <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-4 flex items-center gap-1.5">
                      <Wrench size={16} className="text-[#a78bfa]" />
                      Curves Cleansing & Despiking
                    </h3>

                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Target Log Curve</label>
                          <select 
                            value={wrangleCurve}
                            onChange={e => setWrangleCurve(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          >
                            {wellData.curves.map((c: any) => (
                              <option key={c.mnemonic} value={c.mnemonic}>{c.mnemonic}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Running Median Window</label>
                          <input 
                            type="number"
                            min="3" max="21" step="2"
                            value={despikeWindow}
                            onChange={e => setDespikeWindow(parseInt(e.target.value))}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={applyDespike}
                        disabled={isWrangling}
                        className="py-2 bg-[#865be9] hover:bg-[#7542e5] rounded text-white text-xs font-bold shadow-md shadow-[#865be9]/20"
                      >
                        Apply Running Median Outliers Filter
                      </button>

                      <hr className="border-card-border/10 my-1" />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Cleanse Method</label>
                          <select 
                            value={cleanseMethod}
                            onChange={e => setCleanseMethod(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          >
                            <option value="both">Both (Interpolate + Clip)</option>
                            <option value="clip">Clip Limits Only</option>
                            <option value="interpolate">Interpolate Nulls Only</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Min Clamp limit</label>
                          <input 
                            type="text"
                            placeholder="None"
                            value={cleanseMin}
                            onChange={e => setCleanseMin(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Max Clamp limit</label>
                          <input 
                            type="text"
                            placeholder="None"
                            value={cleanseMax}
                            onChange={e => setCleanseMax(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={applyCleansing}
                        disabled={isWrangling}
                        className="py-2 bg-[#865be9] hover:bg-[#7542e5] rounded text-white text-xs font-bold shadow-md shadow-[#865be9]/20"
                      >
                        Apply Cleansing & Limits
                      </button>
                    </div>
                  </div>
                </div>

                {/* Log overlays & Synthesis calculations */}
                <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-4 flex items-center gap-1.5">
                      <Layers size={16} className="text-[#a78bfa]" />
                      Curves Merge & Synthesis
                    </h3>

                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Overlay Curve (Secondary)</label>
                          <select 
                            value={mergeSecondary}
                            onChange={e => setMergeSecondary(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          >
                            {wellData.curves.map((c: any) => (
                              <option key={c.mnemonic} value={c.mnemonic}>{c.mnemonic}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Output Curve Name</label>
                          <input 
                            type="text"
                            value={mergeOutput}
                            onChange={e => setMergeOutput(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Merge Strategy</label>
                          <select 
                            value={mergeStrategy}
                            onChange={e => setMergeStrategy(e.target.value)}
                            className="w-full text-xs bg-input border border-input-border p-2 rounded text-white outline-none"
                          >
                            <option value="prefer_primary">Prefer Primary (fill missing indexes with Secondary)</option>
                            <option value="prefer_secondary">Prefer Secondary (fill missing indexes with Primary)</option>
                            <option value="average">Mathematical Average of overlap indexes</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        onClick={applyMerge}
                        disabled={isWrangling}
                        className="py-2 bg-[#865be9] hover:bg-[#7542e5] rounded text-white text-xs font-bold shadow-md shadow-[#865be9]/20"
                      >
                        Merge Curves
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI synthesis module panel */}
              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-4 flex items-center gap-1.5">
                  <Cpu size={16} className="text-[#f97316]" />
                  Machine Learning Log Curves Synthesis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Training Baseline Well</label>
                    <select 
                      value={mlTrainWell}
                      onChange={e => setMlTrainWell(e.target.value)}
                      className="w-full text-xs bg-input border border-input-border p-2.5 rounded text-white outline-none"
                    >
                      <option value="">-- Choose Well --</option>
                      {wellsList.map(well => (
                        <option key={well.id} value={well.filename}>{well.well_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Destination Well</label>
                    <select 
                      value={mlDestWell}
                      onChange={e => setMlDestWell(e.target.value)}
                      className="w-full text-xs bg-input border border-input-border p-2.5 rounded text-white outline-none"
                    >
                      <option value="">-- Choose Well --</option>
                      {wellsList.map(well => (
                        <option key={well.id} value={well.filename}>{well.well_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Model Regressor</label>
                    <select 
                      value={mlModelType}
                      onChange={e => setMlModelType(e.target.value)}
                      className="w-full text-xs bg-input border border-input-border p-2.5 rounded text-white outline-none font-bold"
                    >
                      <option value="xgboost">XGBoost Regressor</option>
                      <option value="linear">Linear Regression</option>
                    </select>
                  </div>
                  <button 
                    onClick={runMLSynthesis}
                    disabled={isWrangling}
                    className="py-2.5 bg-gradient-to-r from-[#865be9] to-[#7542e5] text-white text-xs font-bold rounded-lg shadow-md shadow-[#865be9]/20"
                  >
                    Run AI Synthesis Training
                  </button>
                </div>
                {mlMae !== null && (
                  <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded text-xs text-emerald-400 font-semibold">
                    Success! Synthesis completed. Mean Absolute Error: {mlMae.toFixed(5)} us/ft. Prediction cached into SQLite curves directory.
                  </div>
                )}
              </div>

              {/* Data Wrangle Table preview */}
              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-3">
                  Wrangled logs datasets preview (First 15 depth indexes)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-card-border/30 bg-[#1e1d24]">
                        <th className="p-2.5 font-bold text-text-muted">DEPTH (ft)</th>
                        {wellData.curves.slice(0, 8).map((c: any) => (
                          <th key={c.mnemonic} className="p-2.5 font-bold text-text-muted">{c.mnemonic}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {wellData.data.slice(0, 15).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-card-border/10 hover:bg-[#1e1d24]/50">
                          <td className="p-2.5 font-bold">{row.DEPT.toFixed(1)}</td>
                          {wellData.curves.slice(0, 8).map((c: any) => (
                            <td key={c.mnemonic} className="p-2.5 text-text-secondary">
                              {row[c.mnemonic] !== null ? row[c.mnemonic].toFixed(3) : <span className="text-text-muted italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : (
            /* ==========================================
               PETROPHYSICAL ANALYSIS VIEW 
               ========================================== */
            <section className="flex flex-col gap-6 animate-fade-in">
              
              {/* Quality summary metrics card panel */}
              {calculatedMetrics && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block mb-1">Gross Interval</span>
                    <span className="text-2xl font-extrabold text-white">{calculatedMetrics.gross_thickness.toFixed(1)} <span className="text-xs font-normal text-text-muted">ft</span></span>
                  </div>
                  <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block mb-1">Net Sand Thickness</span>
                    <span className="text-2xl font-extrabold text-white">{calculatedMetrics.net_sand.toFixed(1)} <span className="text-xs font-normal text-text-muted">ft</span></span>
                  </div>
                  <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block mb-1">Net Reservoir Thickness</span>
                    <span className="text-2xl font-extrabold text-white">{calculatedMetrics.net_reservoir.toFixed(1)} <span className="text-xs font-normal text-text-muted">{depthUnit}</span></span>
                  </div>
                  <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden eur-card">
                    <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block mb-1">Net Pay Thickness</span>
                    <span className="text-2xl font-extrabold text-white text-gradient">{calculatedMetrics.net_pay.toFixed(1)} <span className="text-xs font-normal text-text-muted">{depthUnit}</span></span>
                  </div>
                  <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block mb-1">Net-to-Gross (NTG)</span>
                    <span className="text-2xl font-extrabold text-[#f97316]">{calculatedMetrics.ntg.toFixed(3)}</span>
                  </div>
                </div>
              )}

              {/* Stacked Chart visualizer container */}
              {calculatedData.length > 0 && (
                <div className="glass-panel rounded-xl p-6 relative">
                  <div className="flex items-center justify-between border-b border-card-border/30 pb-3 mb-6">
                    <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                      <BarChart4 size={16} className="text-[#a78bfa]" />
                      Multi-track Logging Charts: imported + Interpreted (Depth: {depthUnit})
                    </h3>
                    
                    <span className="text-[10px] text-text-muted font-semibold bg-[#1e1d24] px-2.5 py-1 rounded border border-card-border/20">
                      Top Well Depth: {wellData.summary.start_depth} {depthUnit} | Bottom Depth: {wellData.summary.stop_depth} {depthUnit}
                    </span>
                  </div>

                  {/* Log tracks using lightweight responsive SVGs */}
                  <div className="w-full flex gap-3 h-[700px] overflow-hidden">
                    
                    {/* Track 1: Lithology logs */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Lithology Logs (GR / SP)
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          {/* GR curve */}
                          <polyline 
                            fill="none" stroke="#10b981" strokeWidth="1.2"
                            points={getSvgPath('GR', 0, 150, 100, 650)} 
                          />
                          {/* SP curve */}
                          <polyline 
                            fill="none" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="2,2"
                            points={getSvgPath('SP', -100, 20, 100, 650)} 
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Track 2: Resistivity log (Rt logarithmic) */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Resistivity Log (Rt/ILD)
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          <polyline 
                            fill="none" stroke="#f97316" strokeWidth="1.2"
                            points={getSvgPath('ILD', 0.1, 1000, 100, 650, true)} 
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Track 3: Density - Neutron */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Density-Neutron logs
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          {/* Density curve */}
                          <polyline 
                            fill="none" stroke="#ef4444" strokeWidth="1.2"
                            points={getSvgPath('RHOB', 1.95, 2.95, 100, 650)} 
                          />
                          {/* Neutron curve (NPHI reversed) */}
                          <polyline 
                            fill="none" stroke="#10b981" strokeWidth="1.2"
                            points={getSvgPath('NPHI', 0.45, -0.15, 100, 650)} 
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Track 4: VCL Logs */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Volume of Clay (VCL)
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          <polyline 
                            fill="none" stroke="#06b6d4" strokeWidth="1.5"
                            points={getSvgPath('VCL', 0, 1, 100, 650)} 
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Track 5: Porosities (PHIE / PHIT reversed) */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Porosities (PHIE / PHIT)
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          <polyline 
                            fill="none" stroke="#06b6d4" strokeWidth="1.5"
                            points={getSvgPath('PHIE', 0.4, 0, 100, 650)} 
                          />
                          <polyline 
                            fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="1,1"
                            points={getSvgPath('PHIT', 0.4, 0, 100, 650)} 
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Track 6: Saturation & Net Pay */}
                    <div className="flex-1 border border-card-border/30 rounded-lg p-2 flex flex-col relative bg-[#1e1d24]/20">
                      <div className="text-[10px] font-bold text-center border-b border-card-border/20 pb-1 mb-2 text-text-muted">
                        Water Saturation & Net Pay
                      </div>
                      <div className="flex-1 relative">
                        <svg className="w-full h-full" viewBox="0 0 100 650" preserveAspectRatio="none">
                          {/* Net Pay Flags shading in gold (tozerox filled mock) */}
                          {calculatedMetrics && calculatedMetrics.flags.pay.map((p: number, idx: number) => {
                            if (p === 1) {
                              const y = (idx / calculatedMetrics.flags.pay.length) * 650;
                              return <line key={idx} x1="0" y1={y} x2="100" y2={y} stroke="rgba(251, 191, 36, 0.15)" strokeWidth="4" />;
                            }
                            return null;
                          })}
                          
                          {/* Sw curve reversed */}
                          <polyline 
                            fill="none" stroke="#ef4444" strokeWidth="1.5"
                            points={getSvgPath('SW', 1, 0, 100, 650)} 
                          />
                        </svg>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Pickett Plot Crossplot & Pay Zone metrics display */}
              {calculatedData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  
                  {/* Pickett plot */}
                  <div className="col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-4">
                        Pickett Crossover Crossplot (Clean Sands)
                      </h3>

                      <div className="w-full flex justify-center items-center">
                        <div className="relative border border-card-border/30 bg-[#1e1d24]/60 p-4 rounded-lg w-full max-w-[500px]">
                          <svg className="w-full h-[320px]" viewBox="0 0 400 300">
                            {/* Gridlines */}
                            <line x1="100" y1="0" x2="100" y2="300" stroke="rgba(255,255,255,0.05)" />
                            <line x1="200" y1="0" x2="200" y2="300" stroke="rgba(255,255,255,0.05)" />
                            <line x1="300" y1="0" x2="300" y2="300" stroke="rgba(255,255,255,0.05)" />
                            
                            <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.05)" />
                            <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(255,255,255,0.05)" />

                            {/* Saturation lines */}
                            <path d={`M ${getPickettSwLine(1.0, 400, 300)}`} fill="none" stroke="#ef4444" strokeWidth="1.5" />
                            <path d={`M ${getPickettSwLine(0.6, 400, 300)}`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,4" />
                            <path d={`M ${getPickettSwLine(0.4, 400, 300)}`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,4" />
                            
                            {/* Reservoir clean sands points colored by VCL */}
                            {getPickettPoints(400, 300).map((pt, idx) => (
                              <circle 
                                key={idx} cx={pt.cx} cy={pt.cy} r="2.5" 
                                fill={pt.vcl > 0.05 ? '#f97316' : '#865be9'} 
                                opacity="0.85" 
                              />
                            ))}
                          </svg>

                          <div className="flex justify-between text-[10px] text-text-muted mt-2">
                            <span>Rt = 0.1 ohm.m</span>
                            <span>Rt = 1000 ohm.m</span>
                          </div>
                          
                          <div className="absolute left-1 top-4 text-[10px] text-text-muted rotate-90 transform origin-top-left">
                            PHIe = 0.01 - 0.5 v/v
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pay zone metrics panel */}
                  <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight border-b border-card-border/20 pb-2.5 mb-4">
                        Mean Pay Zone Properties
                      </h3>
                      
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between border-b border-card-border/10 pb-2 text-xs">
                          <span className="text-text-secondary">Clay Volume (VCL)</span>
                          <span className="font-bold text-white">{(calculatedMetrics.mean_vcl_pay * 100).toFixed(1)} %</span>
                        </div>
                        <div className="flex justify-between border-b border-card-border/10 pb-2 text-xs">
                          <span className="text-text-secondary">Effective Porosity (PHIE)</span>
                          <span className="font-bold text-white">{(calculatedMetrics.mean_phie_pay * 100).toFixed(1)} %</span>
                        </div>
                        <div className="flex justify-between border-b border-card-border/10 pb-2 text-xs">
                          <span className="text-text-secondary">Water Saturation (Sw)</span>
                          <span className="font-bold text-white">{(calculatedMetrics.mean_sw_pay * 100).toFixed(1)} %</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-6">
                      <button 
                        onClick={downloadPdfReport}
                        disabled={isPdfExporting}
                        className="w-full py-2.5 bg-gradient-to-r from-[#865be9] to-[#7542e5] hover:opacity-90 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-[#865be9]/20"
                      >
                        <FileDown size={14} />
                        {isPdfExporting ? 'Generating Report...' : 'Download PDF Analysis Report'}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={downloadCsv}
                          className="py-2 bg-input border border-input-border hover:bg-card-border/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 text-text-secondary"
                        >
                          <FileSpreadsheet size={13} />
                          Export CSV
                        </button>
                        <button 
                          onClick={downloadCsv}
                          className="py-2 bg-input border border-input-border hover:bg-card-border/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 text-text-secondary"
                        >
                          <FileSpreadsheet size={13} />
                          Export Excel
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </section>
          )}

        </main>

        {/* Right collapsible interpretation parameters panel */}
        {rightPanelOpen && wellData && !wrangleMode && (
          <aside className="w-80 border-l border-card-border/30 bg-sidebar flex flex-col shrink-0 overflow-y-auto p-4 z-20">
            <div className="flex items-center justify-between border-b border-card-border/20 pb-2.5 mb-4">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-muted flex items-center gap-1">
                <Settings size={12} className="text-[#a78bfa]" />
                Interpretation Settings
              </h3>
              <button 
                onClick={() => setRightPanelOpen(false)}
                className="text-text-muted hover:text-white"
              >
                <ArrowLeft size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-5 text-xs">
              
              {/* VCL Settings */}
              <div>
                <h4 className="font-bold text-white mb-2 text-[11px] border-l-2 border-[#865be9] pl-1.5 uppercase">Clay Volume Endpoints</h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>GR Clean (api)</span>
                      <span className="font-bold">{grClean}</span>
                    </div>
                    <input 
                      type="range" min="10" max="100" step="1"
                      value={grClean}
                      onChange={e => setGrClean(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>GR Clay (api)</span>
                      <span className="font-bold">{grClay}</span>
                    </div>
                    <input 
                      type="range" min="80" max="200" step="1"
                      value={grClay}
                      onChange={e => setGrClay(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted uppercase font-bold">VCL GR Correction</span>
                    <select 
                      value={vclGrCorrection} 
                      onChange={e => setVclGrCorrection(e.target.value)}
                      className="bg-input border border-input-border p-1.5 rounded outline-none w-full"
                    >
                      <option value="linear">Linear Index (IGR)</option>
                      <option value="young">Larionov (Younger)</option>
                      <option value="older">Larionov (Older)</option>
                      <option value="clavier">Clavier (1971)</option>
                      <option value="steiber">Steiber (Tertiary)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Porosities Settings */}
              <div>
                <h4 className="font-bold text-white mb-2 text-[11px] border-l-2 border-[#865be9] pl-1.5 uppercase">Porosity Parameters</h4>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-text-muted uppercase font-bold">Porosity combination method</span>
                    <select 
                      value={porosityMethod} 
                      onChange={e => setPorosityMethod(e.target.value)}
                      className="bg-input border border-input-border p-1.5 rounded outline-none w-full"
                    >
                      <option value="density_neutron">Density-Neutron combination</option>
                      <option value="density">Density Only (PHID)</option>
                      <option value="sonic_willie">Willie Time Average (Sonic)</option>
                      <option value="sonic_rhg">Raymer-Hunt-Gardner (Sonic)</option>
                      <option value="neutron">Neutron Only (PHIN)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">Matrix Density</span>
                      <input 
                        type="number" step="0.01" value={denMa} 
                        onChange={e => setDenMa(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">Fluid Density</span>
                      <input 
                        type="number" step="0.01" value={denFl} 
                        onChange={e => setDenFl(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">Shale Density</span>
                      <input 
                        type="number" step="0.01" value={denSh} 
                        onChange={e => setDenSh(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">Shale Neutron</span>
                      <input 
                        type="number" step="1" value={phinSh} 
                        onChange={e => setPhinSh(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Archie Sw settings */}
              <div>
                <h4 className="font-bold text-white mb-2 text-[11px] border-l-2 border-[#865be9] pl-1.5 uppercase">Archie Sw saturation</h4>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">Rw (ohm.m)</span>
                      <input 
                        type="number" step="0.01" value={rw} 
                        onChange={e => setRw(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">a (tortuosity)</span>
                      <input 
                        type="number" step="0.1" value={aConst} 
                        onChange={e => setAConst(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">m (cementation)</span>
                      <input 
                        type="number" step="0.05" value={mConst} 
                        onChange={e => setMConst(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block mb-1">n (saturation exp)</span>
                      <input 
                        type="number" step="0.1" value={nConst} 
                        onChange={e => setNConst(parseFloat(e.target.value))}
                        className="bg-input border border-input-border p-1.5 rounded text-white outline-none w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cutoffs */}
              <div>
                <h4 className="font-bold text-white mb-2 text-[11px] border-l-2 border-[#865be9] pl-1.5 uppercase">Pay Zone Cut-offs</h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Max Clay (VCL)</span>
                      <span className="font-bold">{vclCutoff.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="0.8" step="0.01"
                      value={vclCutoff}
                      onChange={e => setVclCutoff(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Min Porosity (PHIE)</span>
                      <span className="font-bold">{phieCutoff.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0.01" max="0.3" step="0.01"
                      value={phieCutoff}
                      onChange={e => setPhieCutoff(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Max Saturation (Sw)</span>
                      <span className="font-bold">{swCutoff.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0.2" max="0.9" step="0.01"
                      value={swCutoff}
                      onChange={e => setSwCutoff(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

            </div>
          </aside>
        )}

        {/* Collapsed setting panel button */}
        {!rightPanelOpen && wellData && !wrangleMode && (
          <button 
            onClick={() => setRightPanelOpen(true)}
            className="absolute right-4 top-4 z-30 p-2.5 bg-gradient-to-r from-[#865be9] to-[#7542e5] text-white rounded-full shadow-lg"
            title="Open Parameters Settings"
          >
            <Sliders size={18} />
          </button>
        )}

      </div>

      {/* Old Status Bar Footer Removed */}

    </div>
  );
}
