import React, { useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, TimeScale, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { useTheme, alpha } from '@mui/material';
import getShotChartConfig from './ChartConfig';
import { PhaseTypes, CurveStyles } from '../../models/profile';

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend);

function getPressureTarget(phase) {
  if (phase.type === PhaseTypes.FLOW) return [null, null];
  return [phase.target.start, phase.target.end || phase.target.start];
}

function getFlowTarget(phase) {
  if (phase.type === PhaseTypes.PRESSURE) return [null, null];
  return [phase.target.start, phase.target.end || phase.target.start];
}

function generateTransitionData(transitionType, startValue, endValue, startTime, endTime, curveDuration) {
  const data = [];
  
  if (startValue === null || endValue === null) return data;

  const stepInterval = 0.1; 
  const stepCount = Math.floor(curveDuration / stepInterval);

  if (transitionType === 'INSTANT' || transitionType === CurveStyles.INSTANT || curveDuration <= 0) {
    data.push({ x: startTime, y: endValue });
    data.push({ x: endTime, y: endValue });
    return data;
  }

  for (let i = 0; i <= stepCount; i++) {
    const time = startTime + (i * stepInterval);
    const progress = i / stepCount;
    let value;

    switch(transitionType) {
      case 'EASE_IN_OUT':
      case CurveStyles.EASE_IN_OUT:
        value = startValue + (endValue - startValue) * (0.5 - Math.cos(Math.PI * progress) / 2);
        break;
      case 'EASE_IN':
      case CurveStyles.EASE_IN:
        value = startValue + (endValue - startValue) * (progress * progress);
        break;
      case 'EASE_OUT':
      case CurveStyles.EASE_OUT:
        value = startValue + (endValue - startValue) * (1 - (1 - progress) * (1 - progress));
        break;
      case 'LINEAR':
      case CurveStyles.LINEAR:
      default:
        value = startValue + (endValue - startValue) * progress;
        break;
    }
    data.push({ x: time, y: value });
  }
  return data;
}

function profileToDatasets(profile) {
  const data = { pressureData: [], flowData: [], pressureLimit: [], flowLimit: [] };
  let phaseStartTimeSec = 0;
  
  if (profile && profile.phases) {
    profile.phases.forEach((phase) => {
      const phaseTimeSec = (phase.stopConditions?.time || 5000) / 1000;
      const transitionTimeSec = (phase.target.time !== undefined ? phase.target.time : (phase.stopConditions?.time || 5000)) / 1000;

      const pTargets = getPressureTarget(phase);
      const fTargets = getFlowTarget(phase);
      const curveType = phase.target.curve || 'LINEAR';

      const tStart = phaseStartTimeSec;
      const tCurveEnd = phaseStartTimeSec + transitionTimeSec;
      const tPhaseEnd = phaseStartTimeSec + phaseTimeSec;

      const pCurvePoints = generateTransitionData(curveType, pTargets[0], pTargets[1], tStart, tCurveEnd, transitionTimeSec);
      const fCurvePoints = generateTransitionData(curveType, fTargets[0], fTargets[1], tStart, tCurveEnd, transitionTimeSec);

      data.pressureData.push(...pCurvePoints);
      data.flowData.push(...fCurvePoints);

      if (transitionTimeSec < phaseTimeSec) {
        if (pTargets[1] !== null) data.pressureData.push({ x: tPhaseEnd, y: pTargets[1] });
        if (fTargets[1] !== null) data.flowData.push({ x: tPhaseEnd, y: fTargets[1] });
      }

      const restriction = phase.restriction > 0 ? phase.restriction : null;
      const pLimit = (phase.type === PhaseTypes.FLOW) ? restriction : null;
      const fLimit = (phase.type === PhaseTypes.PRESSURE) ? restriction : null;

      data.pressureLimit.push({ x: tStart, y: pLimit });
      data.pressureLimit.push({ x: tPhaseEnd, y: pLimit });
      data.flowLimit.push({ x: tStart, y: fLimit });
      data.flowLimit.push({ x: tPhaseEnd, y: fLimit });


      phaseStartTimeSec += phaseTimeSec; 
    });
  }
  return data;
}

function mapToChartData(profile, storedProfile, theme) {
  const data = profileToDatasets(profile);
  
  const storedData = storedProfile ? profileToDatasets(storedProfile) : null;

  const datasets = [
    {
      label: 'Pressure',
      data: data.pressureData,
      backgroundColor: alpha(theme.palette.pressure?.main || '#2196f3', 0.8),
      borderColor: theme.palette.pressure?.main || '#2196f3',
      tension: 0,
      yAxisID: 'y2', 
      spanGaps: true,
    },
    {
      label: 'Flow',
      data: data.flowData,
      backgroundColor: alpha(theme.palette.flow?.main || '#9c27b0', 0.8),
      borderColor: theme.palette.flow?.main || '#9c27b0',
      tension: 0,
      yAxisID: 'y2',
      spanGaps: true,
    },
    {
      label: 'Pressure Limit',
      data: data.pressureLimit,
      borderColor: alpha(theme.palette.pressure?.main || '#2196f3', 0.4), // Lighter color
      borderDash: [10, 5], // Dotted line style
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      yAxisID: 'y1',
      spanGaps: true,
    },
    {
      label: 'Flow Limit',
      data: data.flowLimit,
      borderColor: alpha(theme.palette.flow?.main || '#9c27b0', 0.4), // Lighter color
      borderDash: [10, 5], // Dotted line style
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      yAxisID: 'y2',
      spanGaps: true,
    }
  ];

  if (storedData) {
    datasets.push({
      label: 'Stored Pressure',
      data: storedData.pressureData,
      borderColor: '#B0BEC5',
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0,
      yAxisID: 'y2',
      spanGaps: true,
    });

    datasets.push({
      label: 'Stored Flow',
      data: storedData.flowData,
      borderColor: '#CE93D8',
      borderDash: [5, 5],
      pointRadius: 0,
      tension: 0,
      yAxisID: 'y2',
      spanGaps: true,
    });
  }

  return { datasets };
}

function ProfileChart({ profile, storedProfile }) {
  const chartRef = useRef(null);
  const theme = useTheme();
  
  const config = useMemo(() => {
    try { return getShotChartConfig(theme); } catch(e) { return {}; }
  }, [theme]);
  
  const chartData = mapToChartData(profile, storedProfile, theme);

  return <Line ref={chartRef} options={config} data={chartData} />;
}

export default ProfileChart;