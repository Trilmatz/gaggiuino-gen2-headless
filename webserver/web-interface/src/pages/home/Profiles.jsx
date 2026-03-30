import React, { useState, useEffect, useRef } from 'react';
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
  const hasRequestedProfile = useRef(false);

  // -------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------
  // const [elements, setElements] = useState([
  //   { id: 1, type: 'select', value: 'PRESSURE' },
  //   { id: 2, type: 'select', value: 'LINEAR' },
  //   { id: 3, type: 'text', value: '0' },
  //   { id: 4, type: 'text', value: '9' },
  //   { id: 5, type: 'text', value: '5' },
  //   { id: 6, type: 'text', value: '30' },
  // ]);
  const [elements, setElements] = useState([]);
  const [nextId, setNextId] = useState(7);
  const [error, setError] = useState(null);
  
  // profile = The one you are building in the inputs
  const [profile, setProfile] = useState(new Profile([], {}));
  // storedProfile = The one currently active on the machine (received via WebSocket)
  const [storedProfile, setStoredProfile] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [selectedProfileName, setSelectedProfileName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");

  // -------------------------------------------------------------
  // WEBSOCKET
  // -------------------------------------------------------------
  const { sendMessage, lastJsonMessage, readyState } = useWebSocket(`ws://${apiHost}/ws`, {
    share: true,
    shouldReconnect: () => true,
  });

  // -------------------------------------------------------------
  // LOAD SAVED PROFILES FROM LOCAL STORAGE
  // -------------------------------------------------------------
  useEffect(() => {
    const stored = localStorage.getItem("gaggiuino_profiles");
    if (stored) {
      setSavedProfiles(JSON.parse(stored));
    }
  }, []);

  // -------------------------------------------------------------
  // Request profile
  // -------------------------------------------------------------
  useEffect(() => {
      // As soon as the WebSocket connection is open, ask the ESP32 for the active profile
      if (readyState === ReadyState.OPEN && !hasRequestedProfile.current) {
        console.log("Requesting active profile from ESP...");
        sendMessage(JSON.stringify({ action: "request_active_profile", data: "" }));
        hasRequestedProfile.current = true;
      }
    }, [readyState]);

  useEffect(() => {
    // Listen for the exact action string we defined in websocket.cpp
    // Alternatively, if you imported MSG_TYPE_PROFILE_DATA from api.js, use that here!
    if (lastJsonMessage && lastJsonMessage.action === 'profile_update') {
      console.log("Received Stored Profile:", lastJsonMessage.data);
      try {
        // Parse the raw JSON data into your Profile class structure
        const incoming = Profile.parse(lastJsonMessage.data);
        setStoredProfile(incoming);
      } catch (e) {
        console.error("Error parsing stored profile:", e);
      }
    }
  }, [lastJsonMessage]);


  // -------------------------------------------------------------
  // LIVE CHART UPDATE
  // -------------------------------------------------------------
  useEffect(() => {
    try {
      const phases = [];
      for (let i = 0; i < elements.length; i += 6) {
        if (i + 5 >= elements.length) break;

        const typeStr = elements[i].value;
        const curveStr = elements[i+1].value;
        const startVal = parseFloat(elements[i+2].value) || 0;
        const endVal = parseFloat(elements[i+3].value) || 0;
        const duration = parseFloat(elements[i+4].value) || 0;
        const stopTime = parseFloat(elements[i+5].value) || 0;

        const phaseType = (typeStr === 'FLOW') ? PhaseTypes.FLOW : PhaseTypes.PRESSURE;
        
        let curveStyle = CurveStyles.LINEAR;
        if (curveStr === 'INSTANT') curveStyle = CurveStyles.INSTANT;
        if (curveStr === 'EASE_IN') curveStyle = CurveStyles.EASE_IN;
        if (curveStr === 'EASE_OUT') curveStyle = CurveStyles.EASE_OUT;
        if (curveStr === 'EASE_IN_OUT') curveStyle = CurveStyles.EASE_IN_OUT;
        
        phases.push(new Phase(
          phaseType,
          new Transition(startVal, endVal, curveStyle, duration * 1000),
          -1, 
          { time: stopTime * 1000, weight: -1 }
        ));
      }
      setProfile(new Profile(phases, {}));
    } catch (e) {
      console.error("Failed to build live profile preview", e);
    }
  }, [elements]);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleRunProfile = () => {
    //if (readyState !== ReadyState.OPEN) return;

    try {
      const payload = {
        action: "run_profile",
        data: profile
      };
      console.log("Uploading Profile:", JSON.stringify(payload));
      sendMessage(JSON.stringify(payload));
    } catch (e) {
      setError("Failed to upload profile");
    }
  };

  const handleAddRow = () => {
    setElements([...elements, 
      { id: nextId, type: 'select', value: 'PRESSURE' },
      { id: nextId+1, type: 'select', value: 'LINEAR' },
      { id: nextId+2, type: 'text', value: '0' },
      { id: nextId+3, type: 'text', value: '9' },
      { id: nextId+4, type: 'text', value: '5' },
      { id: nextId+5, type: 'text', value: '10' }
    ]);
    setNextId(nextId + 6);
  };

  const handleRemoveRow = () => {
    if (elements.length <= 6) return;
    const newElements = [...elements];
    for(let i=0; i<6; i++) newElements.pop();
    setElements(newElements);
  };

  const handleRemoveAll = () => {
    setElements([]);
    setNextId(7);
  };

  const handleInputChange = (event, id) => {
    setElements(elements.map(el => el.id === id ? { ...el, value: event.target.value } : el));
  };

  const handleSaveToBrowser = () => {
    if (!newProfileName) return;
    
    // Package up the current UI inputs
    const newProfile = {
      name: newProfileName,
      elements: elements // Save the exact input rows!
    };

    const updatedProfiles = [...savedProfiles, newProfile];
    setSavedProfiles(updatedProfiles);
    localStorage.setItem("gaggiuino_profiles", JSON.stringify(updatedProfiles));
    setNewProfileName("");
    setSelectedProfileName(newProfileName);
  };

  const handleSelectProfile = (event) => {
    const name = event.target.value;
    setSelectedProfileName(name);

    const target = savedProfiles.find(p => p.name === name);
    if (target) {
      setElements(target.elements);
      // sendMessage(JSON.stringify({ action: "run_profile", data: profile }));
      const highestId = target.elements.length > 0 
        ? Math.max(...target.elements.map(el => el.id)) 
        : 0;
      setNextId(highestId + 1);
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div>
      <Container sx={{ mt: theme.spacing(2) }}>
        <Card sx={{ mt: theme.spacing(2) }}>
          <CardContent>
            <Typography gutterBottom variant="h5">Profile Manager</Typography>
            <Grid container spacing={2} alignItems="center">
              
              {/* Dropdown to select a saved profile */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Load Saved Profile</InputLabel>
                  <Select value={selectedProfileName} label="Load Saved Profile" onChange={handleSelectProfile}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {savedProfiles.map((p, i) => (
                      <MenuItem key={i} value={p.name}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Input to save the current profile */}
              <Grid item xs={12} sm={4}>
                <TextField 
                  label="Save As Name..." 
                  size="small" 
                  fullWidth 
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                 <IconButton onClick={handleSaveToBrowser} color="primary">
                    <UploadFileIcon fontSize="large" />
                 </IconButton>
              </Grid>

            </Grid>
          </CardContent>
        </Card>
      </Container>

      {/* Build Profile Card */}
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
                  <IconButton onClick={handleRunProfile} style={{ float: 'right' }} color="primary" sx={{ ml: theme.spacing(3) }}>
                    <AutoGraphIcon fontSize="large" />
                  </IconButton>
                  
                  <div style={{ marginTop: '20px' }}>
                    <Grid container spacing={2} alignItems="center">
                      {elements.map((element, index) => {
                        const colIndex = index % 6; 
                        
                        // Render Selectors and Inputs (Same as your code)
                        if (colIndex === 0) {
                          return (
                            <Grid item xs={6} sm={2} key={element.id}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Type</InputLabel>
                                <Select value={element.value} label="Type" onChange={(e) => handleInputChange(e, element.id)}>
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
                                  <Select value={element.value} label="Curve" onChange={(e) => handleInputChange(e, element.id)}>
                                    <MenuItem value="LINEAR">Linear</MenuItem>
                                    <MenuItem value="EASE_IN_OUT">Ease In Out</MenuItem>
                                    <MenuItem value="INSTANT">Instant</MenuItem>
                                    <MenuItem value="EASE_IN">Ease In</MenuItem>
                                    <MenuItem value="EASE_OUT">Ease Out</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            );
                        }
                        let label = colIndex === 2 ? "Start" : colIndex === 3 ? "End" : colIndex === 4 ? "Ramp" : "Max Time";
                        return (
                          <Grid item xs={6} sm={2} key={element.id}>
                            <TextField label={label} value={element.value} onChange={(e) => handleInputChange(e, element.id)} size="small" type="number" fullWidth />
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

      {/* Chart Card */}
      <Container sx={{ mt: theme.spacing(2) }}>
        <Paper sx={{ mt: theme.spacing(2), p: theme.spacing(2) }}>
          <Typography variant="h5" sx={{ mb: theme.spacing(2) }}>
            Profile Preview
          </Typography>
          <Grid container columns={{ xs: 1, sm: 3 }} spacing={2}>
            <Grid item xs={1} sm={3}>
              <Alert severity={error ? 'error' : 'success'}>
                {error || 'Ready to run'}
              </Alert>
            </Grid>
            <Grid item xs={12} height="400">
              <div style={{ height: '600px', width: '100%', position: 'relative' }}>
                <ProfileChart profile={profile} storedProfile={storedProfile} />
              </div>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </div>
  );
}