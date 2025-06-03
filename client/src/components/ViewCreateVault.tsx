import React, {useEffect, useState} from "react";
import {AuthState} from "../types.js";
import {useNavigate} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {Box, Button, TextField, Typography} from "@mui/material";
import {AxiosInstance} from "axios";

function ViewCreateVault({ api } : { api: AxiosInstance }) {
    const [vaultName, setVaultName] = useState<string>('');
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [auth, setAuth] = useState<AuthState | null>(null);
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        api.get<AuthState>('/check-auth').then(res => {
            const currentAuth = res.data;
            setAuth(currentAuth);
            if (!currentAuth.isOwner) {
                showSnackbar("Access Denied: Only Super Admin can create vaults.", "warning");
                navigate('/');
            }
        }).catch(() => {
            showSnackbar("Auth check failed for vault creation", 'error');
            navigate('/login');
        });
    }, [navigate, showSnackbar]);

    const handleCreateVault = async () => {
        if (!vaultName.trim()) {
            showSnackbar('Vault name cannot be empty.', 'warning');
            return;
        }
        setIsCreating(true);
        try {
            const response = await api.post('/vaults', { vaultName: vaultName.trim() });
            showSnackbar(`Vault "${response.data.name}" created successfully. DID: ${response.data.did.substring(0,20)}...`, 'success');
            setVaultName('');
            navigate('/');
        } catch (err: any) {
            showSnackbar("Failed to create vault", 'error');
            console.error(err);
        }
        setIsCreating(false);
    };

    if (!auth) {
        return <p>Loading auth...</p>;
    }

    if (!auth.isOwner) {
        return <p>Access Denied.</p>;
    }

    return (
        <Box sx={{ p: 2, maxWidth: 650 }}>
            <Typography variant="h6">
                Create New Vault
            </Typography>
            <TextField
                label="Vault Name"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                fullWidth
                margin="normal"
                disabled={isCreating}
                slotProps={{
                    htmlInput: {
                        maxLength: 32,
                    },
                }}
            />
            <Button
                variant="contained"
                color="primary"
                onClick={handleCreateVault}
                disabled={isCreating || !vaultName.trim()}
                sx={{ mt: 2 }}
            >
                {isCreating ? 'Creating...' : 'Create Vault'}
            </Button>
        </Box>
    );
}

export default ViewCreateVault;
