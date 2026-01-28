import React, { useState, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import {
  Card, Container, useTheme, Typography, CardContent, CardActions, Paper, TextareaAutosize, Alert,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import QrCodeIcon from '@mui/icons-material/QrCode';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import DeleteIcon from '@mui/icons-material/Delete';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import ProfileChart from '../../components/chart/ProfileChart';
import { apiHost } from '../../models/api';

import { Profile, Phase, PhaseTypes, CurveStyles, Transition } from '../../models/profile';

export default function Profiles() {
  const theme = useTheme();

  // -------------------------------------------------------------
  // SETUP STATE FOR INPUT GRID
  // Treat every 6 elements as one "Row" (Phase)
  // Index 0: Type, 1: Curve, 2: Start, 3: End, 4: Duration, 5: Stop Condition
  // -------------------------------------------------------------
  const [elements, setElements] = useState([
    { id: 1, type: 'select', value: 'PRESSURE' }, // Default to PRESSURE
    { id: 2, type: 'select', value: 'LINEAR' },   // Default to LINEAR
    { id: 3, type: 'text', value: '9' },          // Start
    { id: 4, type: 'text', value: '9' },          // End
    { id: 5, type: 'text', value: '5' },          // Time (Duration)
    { id: 6, type: 'text', value: '30' },         // Stop (Max Time)
  ]);
  const [nextId, setNextId] = useState(7);

  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(new Profile([], {}));
  
  // -------------------------------------------------------------
  // LIVE CHART UPDATE
  // -------------------------------------------------------------
  useEffect(() => {
    try {
      const phases = [];
      
      // Loop through elements in chunks of 6 (1 Row = 6 inputs)
      for (let i = 0; i < elements.length; i += 6) {
        // Safety check: ensure we have a full row
        if (i + 5 >= elements.length) break;

        // Extract raw values
        const typeStr = elements[i].value;
        const curveStr = elements[i+1].value;
        const startVal = parseFloat(elements[i+2].value) || 0;
        const endVal = parseFloat(elements[i+3].value) || 0;
        const duration = parseFloat(elements[i+4].value) || 0;
        const stopTime = parseFloat(elements[i+5].value) || 0;

        // Map strings to internal Enums
        const phaseType = (typeStr === 'FLOW') ? PhaseTypes.FLOW : PhaseTypes.PRESSURE;
        
        let curveStyle = CurveStyles.LINEAR;
        if (curveStr === 'INSTANT') curveStyle = CurveStyles.INSTANT;
        if (curveStr === 'EASE_IN') curveStyle = CurveStyles.EASE_IN;
        
        // Create Phase
        const phase = new Phase(
          phaseType,
          new Transition(startVal, endVal, curveStyle, duration),
          -1, 
          { time: stopTime, weight: -1 }
        );
        phases.push(phase);
      }

      const generatedProfile = new Profile(phases, {});
      setProfile(generatedProfile);

    } catch (e) {
      // Ignore errors while typing incomplete numbers
      console.log("Parsing incomplete input...");
    }
  }, [elements]);

  // -------------------------------------------------------------
  // WEBSOCKET SETUP
  // -------------------------------------------------------------
  const { sendMessage, readyState } = useWebSocket(`ws://${apiHost}/ws`, {
    share: true,
    shouldReconnect: () => true,
  });

  // -------------------------------------------------------------
  // HANDLER: CONVERT GRID TO PROFILE & SEND
  // -------------------------------------------------------------
  const handleRunProfile = () => {
    if (readyState !== ReadyState.OPEN) {
      console.error("WebSocket not ready");
      return;
    }

    try {
      const phases = [];
      
      // Loop through elements in chunks of 6 (1 Row = 6 inputs)
      for (let i = 0; i < elements.length; i += 6) {
        // Extract raw values from the grid
        const typeStr = elements[i].value;       // e.g., "PRESSURE"
        const curveStr = elements[i+1].value;    // e.g., "LINEAR"
        const startVal = parseFloat(elements[i+2].value) || 0;
        const endVal = parseFloat(elements[i+3].value) || 0;
        const duration = parseFloat(elements[i+4].value) || 0;
        const stopTime = parseFloat(elements[i+5].value) || 0;

        // Map strings to internal Symbols/Enums
        const phaseType = typeStr === 'FLOW' ? PhaseTypes.FLOW : PhaseTypes.PRESSURE;
        
        let curveStyle = CurveStyles.LINEAR;
        if (curveStr === 'INSTANT') curveStyle = CurveStyles.INSTANT;
        if (curveStr === 'EASE_IN') curveStyle = CurveStyles.EASE_IN;
        
        // Build the Phase Object
        const phase = new Phase(
          phaseType,
          new Transition(startVal, endVal, curveStyle, duration),
          -1, // Restriction (unused)
          { time: stopTime, weight: -1 } // Stop Conditions
        );
        
        phases.push(phase);
      }

      const generatedProfile = new Profile(phases, {});
      
      // Update the chart preview
      setProfile(generatedProfile);

      // Serialize and Send
      const payload = {
        action: "run_profile",
        data: generatedProfile.serialize() 
      };
      
      console.log("Sending Profile:", JSON.stringify(payload));
      sendMessage(JSON.stringify(payload));

    } catch (e) {
      console.error("Error building profile:", e);
      setError("Failed to build profile from inputs");
    }
  };

  // -------------------------------------------------------------
  // UI HANDLERS
  // -------------------------------------------------------------
  const handleAddRow = () => {
    const newElements = [
      ...elements,
      { id: nextId, type: 'select', value: 'PRESSURE' },
      { id: nextId + 1, type: 'select', value: 'LINEAR' },
      { id: nextId + 2, type: 'text', value: '0' },
      { id: nextId + 3, type: 'text', value: '9' },
      { id: nextId + 4, type: 'text', value: '5' },
      { id: nextId + 5, type: 'text', value: '10' },
    ];
    setElements(newElements);
    setNextId(nextId + 6);
  };

  const handleRemoveRow = () => {
    if (elements.length <= 6) return; // Keep at least one row
    const newElements = [...elements];
    for (let i = 0; i < 6; i++) newElements.pop();
    setElements(newElements);
  };

  const handleRemoveAll = () => {
    // Reset to just one row
    setElements([
      { id: 1, type: 'select', value: 'PRESSURE' },
      { id: 2, type: 'select', value: 'LINEAR' },
      { id: 3, type: 'text', value: '0' },
      { id: 4, type: 'text', value: '9' },
      { id: 5, type: 'text', value: '5' },
      { id: 6, type: 'text', value: '30' },
    ]);
    setNextId(7);
  };

  // Generic Change Handler for Inputs
  const handleInputChange = (event, id) => {
    const updatedElements = elements.map((element) => {
      if (element.id === id) {
        return { ...element, value: event.target.value };
      }
      return element;
    });
    setElements(updatedElements);
  };

  const updateProfile = (value) => {
    try {
      setProfile(Profile.parse(JSON.parse(value)));
      setError(undefined);
    } catch (er) {
      setError(er.message);
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div>
      <Container sx={{ mt: theme.spacing(2) }}>
        <Card sx={{ mt: theme.spacing(2) }}>
          <Grid container columns={{ xs: 1, sm: 2 }}>
            <Grid item xs={1}>
              <CardContent>
                <Typography gutterBottom variant="h5">
                  Load Profile
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton style={{ float: 'right' }} color="primary" sx={{ ml: theme.spacing(3) }}>
                  <UploadFileIcon fontSize="large" />
                </IconButton>
                <IconButton style={{ float: 'right' }} color="primary">
                  <QrCodeIcon fontSize="large" />
                </IconButton>
              </CardActions>
            </Grid>
          </Grid>
        </Card>
      </Container>
      <Container sx={{ mt: theme.spacing(2) }}>
        <Card sx={{ mt: theme.spacing(2) }}>
          <Grid container columns={{ xs: 1, sm: 1 }}>
            <Grid item xs={1}>
              <CardContent>
                <Typography gutterBottom variant="h5">
                  Build Profile
                  <IconButton style={{ float: 'right' }} onClick={handleRemoveAll} color="primary" sx={{ ml: theme.spacing(3) }}>
                    <DeleteIcon fontSize="large" />
                  </IconButton>
                  <IconButton style={{ float: 'right' }} onClick={handleRemoveRow} color="primary" sx={{ ml: theme.spacing(3) }}>
                    <RemoveIcon fontSize="large" />
                  </IconButton>
                  <IconButton style={{ float: 'right' }} onClick={handleAddRow} color="primary" sx={{ ml: theme.spacing(3) }}>
                    <AddIcon fontSize="large" />
                  </IconButton>
                  <IconButton 
                    onClick={handleRunProfile} 
                    style={{ float: 'right' }} 
                    color="primary" aria-label="upload picture" 
                    sx={{ ml: theme.spacing(3) }}
                >
                  <AutoGraphIcon fontSize="large" />
                </IconButton>
                  <div style={{ marginTop: '20px' }}>
                    <Grid container spacing={2} alignItems="center">
                      {elements.map((element, index) => {
                        const colIndex = index % 6; 

                        if (colIndex === 0) {
                          return (
                            <Grid item xs={6} sm={2} key={element.id}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Type</InputLabel>
                                <Select
                                  value={element.value}
                                  label="Type"
                                  onChange={(e) => handleInputChange(e, element.id)}
                                >
                                  <MenuItem value="PRESSURE">Pressure</MenuItem>
                                  <MenuItem value="FLOW">Flow</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          );
                        }
                        
                        if (colIndex === 1) {
                            return (
                              <Grid item xs={6} sm={2} key={element.id}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Curve</InputLabel>
                                  <Select
                                    value={element.value}
                                    label="Curve"
                                    onChange={(e) => handleInputChange(e, element.id)}
                                  >
                                    <MenuItem value="LINEAR">Linear</MenuItem>
                                    <MenuItem value="INSTANT">Instant</MenuItem>
                                    <MenuItem value="EASE_IN">Ease In</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            );
                        }

                        let label = "Value";
                        if (colIndex === 2) label = "Start (Bar/ml)";
                        if (colIndex === 3) label = "End (Bar/ml)";
                        if (colIndex === 4) label = "Ramp Time (s)";
                        if (colIndex === 5) label = "Max Time (s)";

                        return (
                          <Grid item xs={6} sm={2} key={element.id}>
                            <TextField 
                                label={label}
                                value={element.value} 
                                onChange={(e) => handleInputChange(e, element.id)}
                                size="small"
                                type="number"
                                fullWidth
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </div>
                </Typography>
              </CardContent>
            </Grid>
          </Grid>
        </Card>
      </Container>

      <Container sx={{ mt: theme.spacing(2) }}>
        <Paper sx={{ mt: theme.spacing(2), p: theme.spacing(2) }}>
          <Typography variant="h5" sx={{ mb: theme.spacing(2) }}>
            Profile Syntax / Preview
          </Typography>
          <Grid container columns={{ xs: 1, sm: 3 }} spacing={2}>
            <Grid item xs={1} sm={3}>
              <Alert severity={error ? 'error' : 'success'}>
                {error || 'Ready to run'}
              </Alert>
            </Grid>
            <Grid item xs={1} sm={1} sx={{display:'none'}}>
              <TextareaAutosize
                minRows={15}
                onChange={(evt) => updateProfile(evt.target.value)}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid item xs={12} height="400">
              <ProfileChart profile={profile} />
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </div>
  );
}