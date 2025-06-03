import React, {Fragment, useCallback, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {AuthState, ClientVault, ClientVaultItem} from '../types.js';
import {
    Box,
    Button,
    TextField,
    Typography,
    ListItem,
    ListItemText,
    List,
    IconButton,
    InputAdornment,
} from '@mui/material';
import {
    Delete,
    Edit,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {AxiosInstance} from "axios";
import WarningModal from "./WarningModal.js";

function ViewManageVaultItems({ api } : { api: AxiosInstance }) {
    const { vaultDID } = useParams<{ vaultDID: string }>();
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [items, setItems] = useState<ClientVaultItem[]>([]);
    const [vaultDisplayName, setVaultDisplayName] = useState<string>(vaultDID || "Vault");
    const [serviceName, setServiceName] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [isProcessingItem, setIsProcessingItem] = useState<boolean>(false);
    const [itemToRemove, setItemToRemove] = useState<ClientVaultItem | null>(null);
    const [open, setOpen] = useState<boolean>(false);
    const [editingItemOriginalName, setEditingItemOriginalName] = useState<string | null>(null);

    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    const fetchItems = useCallback(async () => {
        if (!vaultDID) {
            return;
        }
        try {
            const response = await api.get(`/vaults/${vaultDID}/items`);

            const itemsMap = response.data as Record<string, ClientVaultItem['metadata'] & {originalName: string, isLogin: boolean}>;
            const itemsArray: ClientVaultItem[] = Object.entries(itemsMap).map(([name, data]) => ({
                name,
                originalName: data.originalName,
                isLogin: data.isLogin,
                metadata: {
                    cid: data.cid,
                    sha256: data.sha256,
                    bytes: data.bytes,
                    type: data.type,
                    added: data.added,
                }
            }));
            setItems(itemsArray);
        } catch (error) {
            showSnackbar("Failed to fetch vault items", 'error');
        }
    }, [vaultDID, showSnackbar, api]);

    useEffect(() => {
        if (!vaultDID) {
            showSnackbar("Vault DID not specified.", "error");
            navigate("/");
            return;
        }
        const checkUserAuthAndVault = async () => {
            try {
                const authRes = await api.get<AuthState>('/check-auth');
                const currentAuth = authRes.data;
                setAuth(currentAuth);

                const canManageItems = currentAuth.isOwner ||
                    currentAuth.vaultAdminFor?.includes(vaultDID) ||
                    currentAuth.vaultModeratorFor?.includes(vaultDID);

                if (!canManageItems) {
                    showSnackbar("Access Denied: Owner, Vault Admin, or Vault Moderator rights required.", 'warning');
                    return;
                }

                try {
                    const vaultsList = (await api.get<ClientVault[]>('/vaults')).data;
                    const foundVault = vaultsList.find(v => v.did === vaultDID);
                    if (foundVault) {
                        setVaultDisplayName(foundVault.name);
                    }
                } catch { }

                await fetchItems();
            } catch (error) {
                showSnackbar('Failed to load page authorization.', 'error');
            }
        };
        checkUserAuthAndVault();
    }, [navigate, vaultDID, fetchItems, showSnackbar]);

    const handleSubmitLoginItem = async () => {
        if (!serviceName.trim() || !username.trim() || !password.trim()) {
            showSnackbar("Service, Username, and Password are required for login items.", 'warning');
            return;
        }
        setIsProcessingItem(true);
        try {
            await api.post(`/vaults/${vaultDID}/items`, {
                itemType: 'login',
                service: serviceName.trim(),
                username: username.trim(),
                password: password.trim(),
            });

            const action = editingItemOriginalName ? "updated" : "added";
            showSnackbar(`Login for "${serviceName.trim()}" ${action} successfully.`, 'success');

            setServiceName('');
            setUsername('');
            setPassword('');
            setShowPassword(false);
            setEditingItemOriginalName(null);

            await fetchItems();
        } catch (error) {
            showSnackbar("Failed to add login item.", 'error');
        }
        setIsProcessingItem(false);
    };

    const handleEditItem = async (itemToEdit: ClientVaultItem) => {
        if (!itemToEdit.isLogin) {
            showSnackbar("Editing is currently only supported for login items.", "info");
            return;
        }
        setIsProcessingItem(true);
        setShowPassword(false);
        try {
            const response = await api.get(`/vaults/${vaultDID}/items/${encodeURIComponent(itemToEdit.originalName)}/content`);
            const loginData = response.data.login;

            if (loginData) {
                setServiceName(loginData.site);
                setUsername(loginData.username);
                setPassword(loginData.password);
                setEditingItemOriginalName(itemToEdit.originalName);
            } else {
                throw new Error("Login item content not found or in unexpected format.");
            }
        } catch (error: any) {
            showSnackbar("Failed to load item details for editing.", "error");
            setServiceName('');
            setUsername('');
            setPassword('');
            setEditingItemOriginalName(null);
        }
        setIsProcessingItem(false);
    };

    const handleCancelEdit = () => {
        setEditingItemOriginalName(null);
        setServiceName('');
        setUsername('');
        setPassword('');
        setShowPassword(false);
    };

    const showRemoveItemModal = (item: ClientVaultItem) => {
        setItemToRemove(item);
        setOpen(true);
    };

    const handleCloseRemoveModal = () => {
        setOpen(false);
        setItemToRemove(null);
    };

    const handleConfirmRemoveItem = async () => {
        if (!itemToRemove) {
            return;
        }
        try {
            await api.delete(`/vaults/${vaultDID}/items/${encodeURIComponent(itemToRemove.originalName)}`);
            showSnackbar(`Item "${itemToRemove.name}" removed successfully.`, 'success');
            await fetchItems();
        } catch (error) {
            showSnackbar(`Failed to remove item "${itemToRemove.name}".`, 'error');
        }
        handleCloseRemoveModal();
    };

    const handleClickShowPassword = () => {
        setShowPassword((prevShowPassword) => !prevShowPassword);
    };

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const canActuallyManage = auth?.isOwner ||
        auth?.vaultAdminFor?.includes(vaultDID!) ||
        auth?.vaultModeratorFor?.includes(vaultDID!);

    if (!auth || !canActuallyManage) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="error">Access Denied. You do not have permission to manage items for this vault.</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <WarningModal
                title="Remove Vault Item"
                warningText={`Are you sure you want to remove the item ${itemToRemove?.name} from the vault ${vaultDisplayName}?`}
                isOpen={open}
                onClose={handleCloseRemoveModal}
                onSubmit={handleConfirmRemoveItem}
            />

            <Box sx={{ p: 2, mb: 2, maxWidth: 650 }}>
                <Typography variant="h6">
                    {editingItemOriginalName ? `Edit Login: ${serviceName}` : 'Add New Login Item'}
                </Typography>
                <TextField
                    label="Service Name (e.g., google.com, AWS Console)"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    fullWidth margin="normal"
                    disabled={!!editingItemOriginalName || isProcessingItem}
                />
                <TextField
                    label="Username / Email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth margin="normal"
                    disabled={isProcessingItem}
                />
                <TextField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth margin="normal"
                    disabled={isProcessingItem}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMouseDownPassword}
                                        edge="end"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                <Box sx={{mt: 2, display: 'flex', gap: 1}}>
                    <Button
                        variant="contained"
                        onClick={handleSubmitLoginItem}
                        disabled={isProcessingItem || !serviceName.trim() || !username.trim() || !password.trim()}
                    >
                        {isProcessingItem ? "Saving..." : (editingItemOriginalName ? "Save Changes" : "Add Login Item")}
                    </Button>
                    {editingItemOriginalName && (
                        <Button variant="outlined" onClick={handleCancelEdit} disabled={isProcessingItem}>
                            Cancel Edit
                        </Button>
                    )}
                </Box>
            </Box>

            <Typography variant="h6" sx={{ ml: 2, mb: 1 }}>Current Vault Items</Typography>
            {items.length === 0 && <Typography sx={{textAlign:'center'}}>No items in this vault yet.</Typography>}
            <List sx={{ maxWidth: 800, mb: 2 }}>
                {items.map((item) => (
                    <Fragment key={item.originalName}>
                        <ListItem
                            secondaryAction={
                            <>
                                {item.isLogin && (
                                    <IconButton edge="end" sx={{mr: 0.5}} onClick={() => handleEditItem(item)} disabled={isProcessingItem}>
                                        <Edit />
                                    </IconButton>
                                )}
                                <IconButton edge="end" onClick={() => showRemoveItemModal(item)}>
                                    <Delete />
                                </IconButton>
                            </>
                            }
                        >
                            <ListItemText
                                primary={`${item.name}`}
                                secondary={`Type: ${item.metadata.type} | Size: ${item.metadata.bytes} bytes | Added: ${format(new Date(item.metadata.added), 'yyyy-MM-dd HH:mm')}`}
                                secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                            />
                        </ListItem>
                    </Fragment>
                ))}
            </List>
        </Box>
    );
}

export default ViewManageVaultItems;
