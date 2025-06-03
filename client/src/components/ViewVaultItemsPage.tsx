import React, {Fragment, useCallback, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {AuthState, ClientVaultItem} from '../types.js';
import {
    Box,
    Button,
    Typography,
    ListItem,
    ListItemText,
    List,
} from '@mui/material';
import { format } from 'date-fns';
import {AxiosInstance} from "axios";
import ItemDetailsModal from "./ItemDetailsModal.js";

function ViewVaultItemsPage({ api }: { api: AxiosInstance }) {
    const { vaultDID } = useParams<{ vaultDID: string }>();
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [items, setItems] = useState<ClientVaultItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [selectedItemForReveal, setSelectedItemForReveal] = useState<ClientVaultItem | null>(null);
    const [revealedItemDetails, setRevealedItemDetails] = useState<{ site?: string; username?: string; password?: string } | null>(null);
    const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
    const [isRevealingDetails, setIsRevealingDetails] = useState(false);

    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    const fetchItems = useCallback(async () => {
        if (!vaultDID) return;
        setIsLoadingItems(true);
        try {
            const response = await api.get(`/vaults/${vaultDID}/items`);
            const itemsMap = response.data as Record<string, ClientVaultItem['metadata'] & { originalName: string, isLogin: boolean }>;
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
        setIsLoadingItems(false);
    }, [vaultDID, showSnackbar, api]);

    useEffect(() => {
        if (!vaultDID) {
            showSnackbar("Vault DID not specified.", "error");
            return;
        }
        const checkUserAuthAndVault = async () => {
            try {
                const authRes = await api.get<AuthState>('/check-auth');
                const currentAuth = authRes.data;
                setAuth(currentAuth);

                const canViewVault = currentAuth.isOwner ||
                    currentAuth.vaultAdminFor?.includes(vaultDID) ||
                    currentAuth.vaultModeratorFor?.includes(vaultDID) ||
                    currentAuth.vaultMemberFor?.includes(vaultDID);

                if (!canViewVault) {
                    showSnackbar("Access Denied: You must be a member of this vault to view its items.", 'warning');
                    return;
                }

                await fetchItems();
            } catch (error) {
                showSnackbar('Failed to load page authorization.', 'error');
            }
        };
        checkUserAuthAndVault();
    }, [navigate, vaultDID, fetchItems, showSnackbar]);

    const handleRevealItem = async (item: ClientVaultItem) => {
        if (!item.isLogin) {
            showSnackbar("Reveal is currently only supported for login items.", "info");
            return;
        }
        setSelectedItemForReveal(item);
        setIsRevealingDetails(true);
        try {
            const response = await api.get(`/vaults/${vaultDID}/items/${encodeURIComponent(item.originalName)}/content`);
            if (response.data && response.data.login) {
                setRevealedItemDetails(response.data.login);
                setIsRevealModalOpen(true);
            } else {
                throw new Error("Invalid item content format received.");
            }
        } catch (error) {
            showSnackbar(`Failed to reveal item "${item.name}".`, 'error');
        }
        setIsRevealingDetails(false);
    };

    const handleCloseRevealModal = () => {
        setIsRevealModalOpen(false);
        setRevealedItemDetails(null);
        setSelectedItemForReveal(null);
    };


    if (!auth) {
        return <></>;
    }

    const canViewThisVault = auth.isOwner ||
        auth.vaultAdminFor?.includes(vaultDID!) ||
        auth.vaultModeratorFor?.includes(vaultDID!) ||
        auth.vaultMemberFor?.includes(vaultDID!);

    if (!canViewThisVault) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="error">Access Denied. You do not have permission to view items in this vault.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{pb:3}}>
            <ItemDetailsModal
                isOpen={isRevealModalOpen}
                onClose={handleCloseRevealModal}
                title={`Details for: ${selectedItemForReveal?.name || 'Item'}`}
                itemDetails={revealedItemDetails}
            />

            {isLoadingItems ? (
                <></>
            ) : items.length === 0 ? (
                <Typography sx={{ textAlign: 'center', mt: 2 }}>No items found in this vault.</Typography>
            ) : (
                <List sx={{ maxWidth: 650, mx: 'auto', mb: 2 }}>
                    {items.map((item, _) => (
                        <Fragment key={item.originalName}>
                            <ListItem
                                secondaryAction={
                                    item.isLogin ? (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => handleRevealItem(item)}
                                            disabled={isRevealingDetails && selectedItemForReveal?.originalName === item.originalName}
                                        >
                                            Reveal
                                        </Button>
                                    ) : null
                                }
                            >
                                <ListItemText
                                    primary={item.name}
                                    secondary={`Type: ${item.metadata.type} | Size: ${item.metadata.bytes} bytes | Added: ${item.metadata.added ? format(new Date(item.metadata.added), 'yyyy-MM-dd HH:mm') : 'N/A'}`}
                                    secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                />
                            </ListItem>
                        </Fragment>
                    ))}
                </List>
            )}
        </Box>
    );
}

export default ViewVaultItemsPage;
