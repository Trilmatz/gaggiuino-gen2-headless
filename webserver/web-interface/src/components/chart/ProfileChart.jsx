import React, { useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, TimeScale, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { useTheme, alpha } from '@mui/material';
import getShotChartConfig from './ChartConfig';
import { PhaseTypes } from '../../models/profile';

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend);

function getPressureTarget(phase) {
  if (phase.type === PhaseTypes.FLOW) return [null, null];
  return [phase.target.start, phase.target.end || phase.target.start];
}

function getFlowTarget(phase) {
  if (phase.type === PhaseTypes.PRESSURE) return [null, null];
  return [phase.target.start, phase.target.end || phase.target.start];
}

function profileToDatasets(profile) {
  const data = { labels: [], pressureData: [], flowData: [], pressureLimit: [], flowLimit: []};
  let phaseStartTime = 0;
  
  if (profile && profile.phases) {
    profile.phases.forEach((phase) => {
      // Logic for time conversion (seconds to ms)
      const phaseTime = phase.stopConditions?.time || 5000;
      const transitionTime = (phase.target.time !== undefined) ? phase.target.time : phaseTime;

      const pressureTargets = getPressureTarget(phase);
      const flowTargets = getFlowTarget(phase);

      const restriction = phase.restriction > 0 ? phase.restriction : null;
      const pLimit = (phase.type === PhaseTypes.FLOW) ? restriction : null;
      const fLimit = (phase.type === PhaseTypes.PRESSURE) ? restriction : null;

      const t0 = phaseStartTime / 1000;
      data.flowData.push({ x: t0, y: flowTargets[0] });
      data.pressureData.push({ x: t0, y: pressureTargets[0] });
      data.pressureLimit.push({ x: t0, y: pLimit });
      data.flowLimit.push({ x: t0, y: fLimit });

      if (transitionTime < phaseTime && transitionTime > 0) {
        const t1 = (phaseStartTime + transitionTime) / 1000;
        data.flowData.push({ x: t1, y: flowTargets[1] });
        data.pressureData.push({ x: t1, y: pressureTargets[1] });
        data.pressureLimit.push({ x: t1, y: pLimit });
        data.flowLimit.push({ x: t1, y: fLimit });
      }
      
      const t2 = (phaseStartTime + phaseTime) / 1000;
      data.flowData.push({ x: t2, y: flowTargets[1] });
      data.pressureData.push({ x: t2, y: pressureTargets[1] });
      data.pressureLimit.push({ x: t2, y: pLimit });
      data.flowLimit.push({ x: t2, y: fLimit });

      phaseStartTime += phaseTime;
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
      tension: 0.1,
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
      tension: 0.1,
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