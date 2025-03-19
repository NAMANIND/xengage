import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Connection, ConnectionCategory } from "../types";

interface ConnectionManagerProps {
  onClose: () => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onClose }) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const result = await chrome.storage.local.get("connections"); //
      setConnections(result.connections || []);
    } catch (error) {
      console.error("Error loading connections:", error);
    }
  };

  const saveConnections = async (updatedConnections: Connection[]) => {
    try {
      await chrome.storage.local.set({ connections: updatedConnections });
      setConnections(updatedConnections);
    } catch (error) {
      console.error("Error saving connections:", error);
    }
  };

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection(connection);
    setIsDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingConnection) return;

    const updatedConnections = connections.map((conn) =>
      conn.rest_id === editingConnection.rest_id ? editingConnection : conn
    );

    await saveConnections(updatedConnections);
    setIsDialogOpen(false);
    setEditingConnection(null);
  };

  const handleDeleteConnection = async (connectionId: string) => {
    const updatedConnections = connections.filter(
      (conn) => conn.rest_id !== connectionId
    );
    await saveConnections(updatedConnections);
  };

  const getCategoryColor = (category: ConnectionCategory) => {
    const colors = {
      lead: "#4CAF50",
      recruiter: "#2196F3",
      friend: "#FF9800",
      colleague: "#9C27B0",
      mentor: "#F44336",
      other: "#757575",
    };
    return colors[category];
  };

  return (
    <Box className="min-h-screen bg-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <Typography variant="h4" className="mb-6" color="text.primary">
          Manage Connections
        </Typography>

        <AnimatePresence mode="popLayout">
          {connections.map((connection) => (
            <motion.div
              key={connection.rest_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4"
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar
                        src={connection.profile_image_url}
                        alt={connection.name}
                      />
                      <div>
                        <Typography variant="h6" color="text.primary">
                          {connection.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{connection.screen_name}
                        </Typography>
                      </div>
                      <Chip
                        label={connection.category}
                        style={{
                          backgroundColor: getCategoryColor(
                            connection.category
                          ),
                          color: "white",
                        }}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <IconButton
                        onClick={() => handleEditConnection(connection)}
                        size="small"
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() =>
                          handleDeleteConnection(connection.rest_id)
                        }
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </div>
                  {connection.notes && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      className="mt-2 bg-gray-50 p-3 rounded-lg"
                    >
                      {connection.notes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        <Dialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              zIndex: 1000,
            },
          }}
        >
          <DialogTitle sx={{ color: "text.primary" }}>
            Edit Connection
          </DialogTitle>
          <DialogContent>
            {editingConnection && (
              <div className="space-y-4 mt-4">
                <FormControl fullWidth>
                  <InputLabel
                    id="category-label"
                    sx={{ color: "text.secondary" }}
                  >
                    Category
                  </InputLabel>
                  <Select
                    labelId="category-label"
                    value={editingConnection.category}
                    label="Category"
                    onChange={(e) =>
                      setEditingConnection({
                        ...editingConnection,
                        category: e.target.value as ConnectionCategory,
                      })
                    }
                    sx={{
                      bgcolor: "background.paper",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "divider",
                      },
                    }}
                  >
                    <MenuItem value="lead">Lead</MenuItem>
                    <MenuItem value="recruiter">Recruiter</MenuItem>
                    <MenuItem value="friend">Friend</MenuItem>
                    <MenuItem value="colleague">Colleague</MenuItem>
                    <MenuItem value="mentor">Mentor</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Notes"
                  value={editingConnection.notes}
                  onChange={(e) =>
                    setEditingConnection({
                      ...editingConnection,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Add your thoughts about this connection..."
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "background.paper",
                      "& fieldset": {
                        borderColor: "divider",
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "text.secondary",
                    },
                  }}
                />
              </div>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2.5, bgcolor: "background.paper" }}>
            <Button
              onClick={() => setIsDialogOpen(false)}
              sx={{ color: "text.secondary" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": {
                  bgcolor: "primary.dark",
                },
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Box>
  );
};

export default ConnectionManager;
