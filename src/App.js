import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { TextField, Box, Autocomplete, Button, Grid, CircularProgress, Dialog, DialogContent, DialogActions, Typography, Menu, MenuItem } from '@mui/material';
import axios from 'axios';

// Function to fetch package data from the NPM registry
const fetchPackageData = async (name, version = 'latest') => {
  try {
    // Make a request to fetch data about the package
    const response = await axios.get(`https://registry.npmjs.org/${name}/${version}`);
    const packageData = response.data;

    // Return a formatted package data object
    return {
      name: packageData.name,
      version: packageData.version,
      repourl: packageData.repository ? packageData.repository.url : 'N/A',
      tarball: packageData.dist ? packageData.dist.tarball : 'N/A',
      licence: packageData.license || 'N/A',
      author: packageData.author ? packageData.author.name : 'N/A',
      description: packageData.description || 'N/A',
      status: 'pending',  // Initial status of the package
    };
  } catch (error) {
    // Log error and return null if fetching fails
    console.error('Error fetching package data:', error);
    return null;
  }
};

const App = () => {
  // Refs for managing references to DOM elements
  const gridRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // State variables
  const [searchText, setSearchText] = useState('');
  const [rowData, setRowData] = useState([]);
  const [filteredRowData, setFilteredRowData] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
  const [openModal, setOpenModal] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [editableVersion, setEditableVersion] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [columnsVisibility, setColumnsVisibility] = useState({
    name: true,
    version: true,
    repourl: true,
    tarball: true,
    licence: true,
    author: true,
    description: true,
    status: true,
    respond: true
  });

  // Cell renderer for the 'Respond' column in the data grid
  const respondCellRenderer = (params) => {
    if (params.data.status === 'accepted' || params.data.status === 'rejected') {
      return null;  // Do not render buttons if status is already accepted or rejected
    }    
    
    // Handler for the 'Accept' button click
    const handleAcceptClick = () => {
      const updatedRowData = filteredRowData.map(row => 
        row.name === params.data.name ? { ...row, status: 'accepted' } : row
      );
      setFilteredRowData(updatedRowData);
    };

    // Handler for the 'Reject' button click
    const handleRejectClick = () => {
      const updatedRowData = filteredRowData.map(row => 
        row.name === params.data.name ? { ...row, status: 'rejected' } : row
      );
      setFilteredRowData(updatedRowData);
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', height: '100%' }}>
        <Button
          onClick={handleAcceptClick} 
          sx={{color:'green', fontSize:"7px", backgroundColor: '#f7f7f7'}}
        >
          <strong>Accept</strong>
        </Button>
        <Button 
          onClick={handleRejectClick} 
          sx={{color:'red', fontSize:"7px", backgroundColor: '#f7f7f7'}}
        >
          <strong>Reject</strong>
        </Button>
      </div>
    );
  };

  // Column definitions for the data grid
  const columnDefs = [
    { headerName: "Name", field: "name", hide: !columnsVisibility.name },
    { headerName: "Version", field: "version", hide: !columnsVisibility.version },
    { headerName: "Repo URL", field: "repourl", hide: !columnsVisibility.repourl },
    { headerName: "Tarball", field: "tarball", hide: !columnsVisibility.tarball },
    { headerName: "Licence", field: "licence", hide: !columnsVisibility.licence },
    { headerName: "Author", field: "author", hide: !columnsVisibility.author },
    { headerName: "Description", field: "description", hide: !columnsVisibility.description },
    {
      headerName: "Status",
      field: "status",
      cellClassRules: {
        'accepted-status': (params) => params.value === 'accepted',
        'rejected-status': (params) => params.value === 'rejected',
        'pending-status': (params) => params.value === 'pending'
      },
      hide: !columnsVisibility.status
    },
    {
      headerName: "Respond",
      field: "respond",
      cellRenderer: respondCellRenderer,
      hide: !columnsVisibility.respond
    }
  ];

  // Open the column visibility menu
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  // Close the column visibility menu
  const handleClose = () => {
    setAnchorEl(null);
  };

  // Toggle visibility of columns
  const handleColumnVisibilityChange = (columnKey) => {
    setColumnsVisibility(prevState => ({
      ...prevState,
      [columnKey]: !prevState[columnKey]
    }));
    handleClose();
  };

  // Menu items for toggling column visibility
  const menuItems = [
    { key: 'repourl', label: 'Repo URL' },
    { key: 'tarball', label: 'Tarball' },
    { key: 'licence', label: 'Licence' },
    { key: 'author', label: 'Author' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'respond', label: 'Respond' },
  ];

  // Effect for debouncing the search text input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [searchText]);

  // Effect to fetch package names based on search text
  useEffect(() => {
    const fetchPackageNames = async () => {
      if (!debouncedSearchText) {
        setOptions([]);
        setRowData([]);
        return;
      }

      setLoading(true);

      try {
        // Fetch package names from NPM registry based on search text
        const response = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${debouncedSearchText}&size=10`);
        const packageNames = response.data.objects.map(pkg => pkg.package.name);
        const packageDataPromises = packageNames.map(name => fetchPackageData(name));
        const packageDataResults = await Promise.all(packageDataPromises);
        const validPackageData = packageDataResults.filter(result => result !== null);
        setOptions(packageNames);
        setRowData(validPackageData);
      } catch (error) {
        // Handle errors and reset states
        console.error('Error fetching package names from NPM registry:', error);
        setOptions([]);
        setRowData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageNames();
  }, [debouncedSearchText]);

  // Effect to update options based on row data
  useEffect(() => {
    setOptions(rowData.map(item => item.name));
  }, [rowData]);

  // Effect to handle grid resizing
  useEffect(() => {
    const handleResize = () => {
      if (gridRef.current && gridRef.current.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Effect to adjust column sizing when visibility changes
  useEffect(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, [columnsVisibility]);

  // Handle search text input change
  const handleSearchChange = (event, newValue) => {
    setSearchText(newValue);
    const selectedRow = rowData.find(item => item.name === newValue);
    setSelectedLibrary(selectedRow || null);
    setEditableVersion(selectedRow?.version || '');
  };

  // Open the modal for adding a library
  const handleOpenModal = () => {
    setSearchText('');
    setSelectedLibrary(null);
    setEditableVersion('');
    setOpenModal(true);

    // Focus on search input after a short delay
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };

  // Close the modal
  const handleCloseModal = () => {
    setOpenModal(false);
  };

  // Handle changes to the editable version input
  const handleVersionChange = (event) => {
    setEditableVersion(event.target.value);
  };

  // Add the selected library to the table with specified version
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

  // Trigger file upload dialog
  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection and processing
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

              // Update filtered row data with new package data
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

  // Callback to handle grid initialization
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
        {`
          .accepted-status {
            color: green;
          }
          .ag-cell {
            font-weight: normal;
          }
          .ag-cell .pending-status {
            font-weight: bold;
          }
        `}
        {`
          .rejected-status {
            color: red;
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
            <Grid item xs={12} md={8}>
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
            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                sx={{ height: '55px', fontSize: '16px', backgroundColor: '#f7f7f7', color: 'black' }}
                onClick={handleClick}
              >
                <strong>▼</strong>
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                {menuItems.map(item => (
                  <MenuItem
                    key={item.key}
                    onClick={() => handleColumnVisibilityChange(item.key)}
                  >
                    {columnsVisibility[item.key] ? 'Hide ' : 'Show '}
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </Grid>
          </Grid>

          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
            <AgGridReact
              ref={gridRef}
              columnDefs={columnDefs}
              rowData={filteredRowData}
              onGridReady={onGridReady}
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