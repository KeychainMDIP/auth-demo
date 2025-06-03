import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip} from '@mui/material';
import { AccountCircle, AddCircleOutline, Lock, ManageSearch } from '@mui/icons-material';
import {AxiosInstance} from "axios";
import { useSnackbar } from '../contexts/SnackbarContext.js';
import { AuthState, ClientVault } from "../types.js";

function Sidebar({ api } : { api: AxiosInstance }) {
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [vaults, setVaults] = useState<ClientVault[]>([]);
    const location = useLocation();
    const { showSnackbar } = useSnackbar();

    const fetchData = useCallback(async () => {
        try {
            const authResponse = await api.get<AuthState>('/check-auth');
            setAuth(prevAuth => JSON.stringify(prevAuth) !== JSON.stringify(authResponse.data) ? authResponse.data : prevAuth);
            if (authResponse.data.isAuthenticated) {
                const vaultsResponse = await api.get<ClientVault[]>('/vaults');
                setVaults(prevVaults => JSON.stringify(prevVaults) !== JSON.stringify(vaultsResponse.data) ? vaultsResponse.data : prevVaults);
            } else {
                setVaults([]);
            }
        } catch (error) {
            showSnackbar('Failed to load sidebar data', 'error');
            setAuth(null);
            setVaults([]);
        }
    }, [showSnackbar, api]);

    useEffect(() => {
        fetchData();
    }, [location.pathname, fetchData]);

    const commonListItemSx = {
        mb: 0.5,
        '&.Mui-selected': {
            backgroundColor: 'action.selected',
            '&:hover': {
                backgroundColor: 'action.selected',
            },
        },
        '&:hover': {
            backgroundColor: 'action.hover',
        },
    };

    const subItemListItemSx = { ...commonListItemSx, pl: 4 };

    const isPathActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    if (!auth || !auth.isAuthenticated) {
        return <></>;
    }

    return (
        <Box
            sx={{
                width: 250,
                flexShrink: 0,
                height: '100%'
            }}
        >
            <List component="nav" dense>
                {auth?.isAuthenticated && (
                    <ListItemButton component={RouterLink} to={`/profile/${auth.userDID}`} sx={commonListItemSx} selected={isPathActive(`/profile/${auth.userDID}`)}>
                        <ListItemIcon sx={{minWidth: 32}}><AccountCircle /></ListItemIcon>
                        <ListItemText primary="Profile" />
                    </ListItemButton>
                )}

                {auth?.isOwner && (
                    <ListItemButton component={RouterLink} to="/create-vault" sx={commonListItemSx} selected={isPathActive('/create-vault')}>
                        <ListItemIcon sx={{minWidth: 32}}><AddCircleOutline /></ListItemIcon>
                        <ListItemText primary="Create Vault" />
                    </ListItemButton>
                )}

                {vaults.length > 0 && (
                    <>
                        {vaults.map((vault) => {
                            const canManageThisVaultMembers = auth.isOwner || auth.vaultAdminFor?.includes(vault.did);
                            const canManageThisVaultItems = auth?.isOwner || auth?.vaultAdminFor?.includes(vault.did) || auth?.vaultModeratorFor?.includes(vault.did);

                            return (
                                <Fragment key={vault.did}>
                                    <ListItem
                                        disablePadding
                                        secondaryAction={
                                            <Tooltip title="View Vault DID Document">
                                                <IconButton
                                                    component={RouterLink}
                                                    to={`/search?did=${vault.did}`}
                                                    size="small"
                                                    edge="end"
                                                >
                                                    <ManageSearch fontSize="inherit" />
                                                </IconButton>
                                            </Tooltip>
                                        }
                                    >
                                        <ListItemButton
                                            component={RouterLink}
                                            to={`/vaults/${vault.did}/view`}
                                            sx={commonListItemSx}
                                            selected={isPathActive(`/vaults/${vault.did}/view`) && !location.pathname.includes('manage-members') && !location.pathname.includes('manage-items')}
                                        >
                                            <ListItemIcon sx={{minWidth: 32}}><Lock /></ListItemIcon>
                                            <ListItemText
                                                primary={vault.name}
                                                primaryTypographyProps={{
                                                    fontWeight: isPathActive(`/vaults/${vault.did}`) ? 'fontWeightMedium' : 'fontWeightRegular',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: 'block'
                                                }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                    <List component="div" disablePadding dense>
                                        {canManageThisVaultItems && (
                                            <ListItemButton component={RouterLink} to={`/vaults/${vault.did}/manage-items`} sx={subItemListItemSx} selected={isPathActive(`/vaults/${vault.did}/manage-items`)}>
                                                <ListItemIcon sx={{minWidth: 32}}>•</ListItemIcon>
                                                <ListItemText primary="Manage Items" />
                                            </ListItemButton>
                                        )}
                                        {canManageThisVaultMembers && (
                                            <ListItemButton component={RouterLink} to={`/vaults/${vault.did}/manage-members`} sx={subItemListItemSx} selected={isPathActive(`/vaults/${vault.did}/manage-members`)}>
                                                <ListItemIcon sx={{minWidth: 32}}>•</ListItemIcon>
                                                <ListItemText primary="Manage Members" />
                                            </ListItemButton>
                                        )}
                                    </List>
                                </Fragment>
                            );
                        })}
                    </>
                )}
            </List>
        </Box>
    );
}

export default Sidebar;
