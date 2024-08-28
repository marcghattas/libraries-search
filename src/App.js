import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { TextField, Box, Autocomplete, Button, Grid, CircularProgress, Dialog, DialogContent, DialogActions, Typography } from '@mui/material';
import axios from 'axios';
//ewhdiuewhfy3
// ButtonCellRenderer component
const ButtonCellRenderer = (props) => {
  const handleAccept = () => {
    console.log('Accepted:', props.data);
  };

  const handleDecline = () => {
    console.log('Declined:', props.data);
  };

  return (
    <Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAccept}
        sx={{ marginRight: '5px' }}
      >
        Accept
      </Button>
      <Button
        variant="outlined"
        color="error"
        onClick={handleDecline}
      >
        Decline
      </Button>
    </Box>
  );
};

// App component
const App = () => {
  const gridRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [rowData, setRowData] = useState([]);
  const [filteredRowData, setFilteredRowData] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
  const [openModal, setOpenModal] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [editableVersion, setEditableVersion] = useState('');

  // Column definitions for ag-Grid
  const columnDefs = [
    { headerName: "Name", field: "name" },
    { headerName: "Version", field: "version" },
    { headerName: "Repo URL", field: "repourl" },
    { headerName: "Tarball", field: "tarball" },
    { headerName: "Licence", field: "licence" },
    { headerName: "Author", field: "author" },
    { headerName: "Description", field: "description" },
    {
      headerName: "Status",
      field: "status",
      cellClassRules: {
        'pending-status': (params) => params.value === 'pending'
      }
    },
    {
      headerName: "Respond",
      field: "respond",
      cellRenderer: 'buttonCellRenderer',
    },
  ];

  // Fetch package data
  const fetchPackageData = async (packageName, version) => {
    try {
      const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
      const data = response.data;
      const latestVersion = version || data['dist-tags'].latest;
      const versionData = data.versions[latestVersion];

      return {
        name: data.name,
        version: latestVersion,
        repourl: data.repository?.url || 'N/A',
        tarball: versionData.dist?.tarball || 'N/A',
        licence: versionData.license || 'N/A',
        author: versionData.author?.name || 'Unknown',
        description: data.description || 'No description',
        status: 'pending',
      };
    } catch (error) {
      console.error('Error fetching package data from NPM registry:', error);
      return null;
    }
  };

  // Handle search input change
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  // Fetch package names and data
  useEffect(() => {
    const fetchPackageNames = async () => {
      if (!debouncedSearchText) {
        setOptions([]);
        setRowData([]);
        return;
      }

      setLoading(true);

      try {
        const response = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${debouncedSearchText}&size=10`);
        const packageNames = response.data.objects.map(pkg => pkg.package.name);
        const packageDataPromises = packageNames.map(name => fetchPackageData(name));
        const packageDataResults = await Promise.all(packageDataPromises);
        const validPackageData = packageDataResults.filter(result => result !== null);
        setOptions(packageNames);
        setRowData(validPackageData);
      } catch (error) {
        console.error('Error fetching package names from NPM registry:', error);
        setOptions([]);
        setRowData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageNames();
  }, [debouncedSearchText]);

  // Update options based on rowData
  useEffect(() => {
    setOptions(rowData.map(item => item.name));
  }, [rowData]);

  // Handle grid resize
  useEffect(() => {
    const handleResize = () => {
      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle search change
  const handleSearchChange = (event, newValue) => {
    setSearchText(newValue);
    const selectedRow = rowData.find(item => item.name === newValue);
    setSelectedLibrary(selectedRow || null);
    setEditableVersion(selectedRow?.version || '');
  };

  // Open modal
  const handleOpenModal = () => {
    setSearchText('');
    setSelectedLibrary(null);
    setEditableVersion('');
    setOpenModal(true);

    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };

  // Close modal
  const handleCloseModal = () => {
    setOpenModal(false);
  };

  // Handle version change
  const handleVersionChange = (event) => {
    setEditableVersion(event.target.value);
  };

  // Add library to table
  const handleAddToTable = async () => {
    if (selectedLibrary) {
      const updatedLibrary = await fetchPackageData(selectedLibrary.name, editableVersion);
      if (updatedLibrary) {
        handleCloseModal();
        setFilteredRowData(prevData => {
          const isRowAlreadyAdded = prevData.some(row => row.name === updatedLibrary.name);
          if (!isRowAlreadyAdded) {
            return [...prevData, updatedLibrary];
          }
          return prevData;
        });
      }
    }
  };

  // Handle file upload click
  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file change
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "application/json") {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const json = JSON.parse(e.target.result);
            if (json.dependencies) {
              const dependencies = Object.entries(json.dependencies);

              const packageDataPromises = dependencies.map(([name, version]) => {
                const cleanedVersion = version.replace(/^\^/, '');

                return fetchPackageData(name, cleanedVersion);
              });
              const packageDataResults = await Promise.all(packageDataPromises);

              const validPackageData = packageDataResults.filter((result) => result !== null);

              setFilteredRowData((prevData) => {
                const newRowData = [...prevData];
                validPackageData.forEach((newPackage) => {
                  if (!newRowData.some((row) => row.name === newPackage.name)) {
                    newRowData.push(newPackage);
                  }
                });
                return newRowData;
              });
            } else {
              alert("The JSON file does not contain any dependencies.");
            }
          } catch (error) {
            alert("There was an error processing the JSON file. Please make sure it is valid.");
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please upload a valid JSON file.");
      }
    }
  };

  // Handle grid ready event
  const onGridReady = (params) => {
    if (params.api) {
      params.api.sizeColumnsToFit();
    }
  };

  return (
    <Box sx={{ margin: '2%' }}>
      <style>
        {`
          .pending-status {
            color: #fcec03;
          }
          .ag-cell {
            font-weight: normal;
          }
          .ag-cell .pending-status {
            font-weight: bold;
          }
        `}
      </style>
      <div className="App">
        <h1>Libraries Info</h1>
        <Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={9}>
              <Box sx={{ height: '50px', backgroundColor: '#f7f7f7', border: '1px solid #b9bec7', borderRadius: '5px', height: '55px' }}></Box>
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Button
                fullWidth
                sx={{ height: '55px', fontSize: '16px', backgroundColor: '#f7f7f7', color: 'black' }}
                onClick={handleOpenModal}
              >
                <strong>Add Library</strong>
              </Button>
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Button
                fullWidth
                sx={{ height: '55px', fontSize: '16px', backgroundColor: '#f7f7f7', color: 'black' }}
                onClick={handleFileUploadClick}
              >
                <strong>Upload File</strong>
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </Grid>
          </Grid>

          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
            <AgGridReact
              ref={gridRef}
              columnDefs={columnDefs}
              rowData={filteredRowData}
              onGridReady={onGridReady}
              frameworkComponents={{ buttonCellRenderer: ButtonCellRenderer }}
              domLayout="autoHeight"
            />
          </div>
        </Box>
        <Dialog
          open={openModal}
          onClose={handleCloseModal}
          sx={{ '& .MuiDialog-paper': { width: '700px', height: '400px' } }}
        >
          <DialogContent>
            <Autocomplete
              sx={{ width: '100%' }}
              freeSolo
              options={options}
              loading={loading}
              inputValue={searchText}
              onInputChange={handleSearchChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search for a library ..."
                  inputRef={searchInputRef}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
            />
            {selectedLibrary && (
              <Box sx={{ marginTop: 2 }}>
                <Typography variant="h6">Library Details</Typography>
                <Typography><strong>Name:</strong> {selectedLibrary.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ marginRight: 2 }}><strong>Version:</strong></Typography>
                  <TextField
                    value={editableVersion}
                    onChange={handleVersionChange}
                    fullWidth
                    variant="standard"
                    margin="normal"
                  />
                </Box>
                <Typography><strong>Repo URL:</strong> {selectedLibrary.repourl}</Typography>
                <Typography><strong>Tarball:</strong> {selectedLibrary.tarball}</Typography>
                <Typography><strong>Licence:</strong> {selectedLibrary.licence}</Typography>
                <Typography><strong>Author:</strong> {selectedLibrary.author}</Typography>
                <Typography><strong>Description:</strong> {selectedLibrary.description}</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal} sx={{ backgroundColor: '#f7f7f7', color: 'black' }}>
              Close
            </Button>
            <Button onClick={handleAddToTable} sx={{ backgroundColor: '#f7f7f7', color: 'black' }}>
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </Box>
  );
}

export default App;