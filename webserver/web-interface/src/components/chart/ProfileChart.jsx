import React, {
  useRef, useMemo,
} from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  TimeScale,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useTheme, alpha } from '@mui/material';
import getShotChartConfig from './ChartConfig';
import { ProfilePropType } from '../../models/propTypes';
import { PhaseTypes } from '../../models/profile';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

function getPressureTarget(phase) {
  if (phase.type === PhaseTypes.FLOW) {
    return [null, null];
  }
  return [phase.target.start, phase.target.end || phase.target.start];
}

function getFlowTarget(phase) {
  if (phase.type === PhaseTypes.PRESSURE) {
    return [null, null];
  }
  return [phase.target.start, phase.target.end || phase.target.start];
}

function profileToDatasets(profile) {
  const data = {
    labels: [],
    pressureData: [],
    flowData: [],
  };

  let phaseStartTime = 0;
  
  if (profile && profile.phases) {
    profile.phases.forEach((phase) => {
      const phaseTimeSec = phase.stopConditions?.time; 
      const phaseTime = phaseTimeSec ? phaseTimeSec * 1000 : 5000;

      const transitionTimeSec = phase.target.time;
      const transitionTime = (transitionTimeSec !== undefined) 
        ? transitionTimeSec * 1000 
        : phaseTime;

      const pressureTargets = getPressureTarget(phase);
      const flowTargets = getFlowTarget(phase);

      // Start
      data.labels.push(phaseStartTime / 1000);
      data.flowData.push(flowTargets[0]);
      data.pressureData.push(pressureTargets[0]);

      // Ramp End (if distinct from Phase End)
      if (transitionTime < phaseTime && transitionTime > 0) {
        data.labels.push((phaseStartTime + transitionTime) / 1000);
        data.flowData.push(flowTargets[1]);
        data.pressureData.push(pressureTargets[1]);
      }
      
      // End
      data.labels.push((phaseStartTime + phaseTime) / 1000);
      data.flowData.push(flowTargets[1]);
      data.pressureData.push(pressureTargets[1]);

      phaseStartTime += phaseTime + 500;
    });
  }

  return data;
}

function mapToChartData(profile, theme) {
  const data = profileToDatasets(profile);
  return {
    labels: data.labels,
    datasets: [
      {
        label: 'Pressure',
        data: data.pressureData,
        backgroundColor: alpha(theme.palette.pressure.main, 0.8),
        borderColor: theme.palette.pressure.main,
        tension: 0.11,
        // NOTE: If graph is still empty, try changing 'y2' to 'y'
        yAxisID: 'y2', 
        spanGaps: true, // Connect lines over nulls
      },
      {
        label: 'Flow',
        data: data.flowData,
        backgroundColor: alpha(theme.palette.flow.main, 0.8),
        borderColor: theme.palette.flow.main,
        tension: 0,
        // NOTE: If graph is still empty, try changing 'y2' to 'y'
        yAxisID: 'y2',
        spanGaps: true,
      },
    ],
  };
}

function ProfileChart({ profile }) {
  const chartRef = useRef(null);
  const theme = useTheme();
  // Ensure we don't crash if theme is loading
  const config = useMemo(() => {
    try { return getShotChartConfig(theme); } 
    catch(e) { return {}; }
  }, [theme]);
  
  const chartData = mapToChartData(profile, theme);

  return (
    <Line
      ref={chartRef}
      options={config}
      data={chartData}
    />
  );
}

export default ProfileChart;

ProfileChart.propTypes = {
  profile: ProfilePropType.isRequired,
};