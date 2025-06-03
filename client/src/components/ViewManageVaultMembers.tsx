import React, { useCallback, useEffect, useState } from "react";
import {
    useNavigate,
    useParams
} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {AuthState, ClientVault, ClientVaultMember} from "../types.js";
import {AxiosInstance} from "axios";
import {
    Box,
    Button,
    Select,
    MenuItem,
    TextField,
    Typography,
    ListItem,
    ListItemText,
    List,
    IconButton
} from '@mui/material';
import {
    Delete,
    Edit,
} from '@mui/icons-material';
import { format } from 'date-fns';
import JsonViewer from './JsonViewer.js'
import WarningModal from "./WarningModal.js";

function ViewManageVaultMembers({ api } : { api: AxiosInstance }) {
    const { vaultDID } = useParams<{ vaultDID: string }>();
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [members, setMembers] = useState<ClientVaultMember[]>([]);
    const [didArg, setDidArg] = useState<string>('');
    const [isEditing, setIsEditing] = useState<ClientVaultMember | null>(null);
    const [removeMember, setRemoveMember] = useState<ClientVaultMember | null>(null);
    const [memberDID, setMemberDID] = useState<string>('');
    const [memberName, setMemberName] = useState<string>('');
    const [memberRole, setMemberRole] = useState<'Admin' | 'Moderator' | 'Member'>('Member');
    const [refresh, setRefresh] = useState<number>(0);
    const [vaultDisplayName, setVaultDisplayName] = useState<string>(vaultDID || "Vault");
    const [open, setOpen] = useState<boolean>(false);
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    const fetchMembers = useCallback(async () => {
        if (!vaultDID) {
            return;
        }
        try {
            const response = await api.get(`/vaults/${vaultDID}/members`);
            setMembers(response.data);
        } catch (err: any) {
            showSnackbar("Failed to fetch members for vault", 'error');
        }
    }, [vaultDID, showSnackbar]);

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

                const canManage = currentAuth.isOwner || currentAuth.vaultAdminFor?.includes(vaultDID);

                if (!canManage) {
                    showSnackbar("Access Denied: Super Admin or Vault Admin rights required.", 'warning');
                    return;
                }

                try {
                    const vaultsList = (await api.get<ClientVault[]>('/vaults')).data;
                    const foundVault = vaultsList.find(v => v.did === vaultDID);
                    if (foundVault) {
                        setVaultDisplayName(foundVault.name);
                    }
                } catch {}

                await fetchMembers();
            } catch (err) {
                showSnackbar('Failed to check auth status', 'error');
            }
        };
        checkUserAuthAndVault();
    }, [navigate, vaultDID, fetchMembers, showSnackbar]);

    const handleAddOrUpdateMember = async () => {
        if (!memberDID.trim() || !memberName.trim()) {
            showSnackbar("Member DID and Name are required.", 'warning');
            return;
        }
        try {
            let successMsg: string;
            if (isEditing) {
                await api.put(`/vaults/${vaultDID}/members/${isEditing.did}`, {
                    newName: memberName,
                    newRole: memberRole,
                });
                successMsg = `Member ${memberName} updated successfully.`;
                setIsEditing(null);
            } else {
                await api.post(`/vaults/${vaultDID}/members`, {
                    memberDID: memberDID.trim(),
                    memberName: memberName.trim(),
                    role: memberRole,
                });
                successMsg = `Member ${memberName} added successfully.`;
            }
            showSnackbar(successMsg, 'success');
            setMemberDID('');
            setMemberName('');
            setMemberRole('Member');
            await fetchMembers();
        } catch (error: any) {
            showSnackbar(error.response.data.message, 'error');
        }
    };

    const handleEdit = (member: ClientVaultMember) => {
        setIsEditing(member);
        setMemberDID(member.did);
        setMemberName(member.name);
        setMemberRole(member.role);
    };

    function showRemoveMemberModal(targetMember: ClientVaultMember) {
        setRemoveMember(targetMember);
        setOpen(true);
    }

    const handleClose = () => {
        setOpen(false);
        setRemoveMember(null);
    };

    const handleRemoveMember = async () => {
        if (!removeMember) {
            showSnackbar("No remove member set", 'warning');
            return;
        }
        try {
            await api.delete(`/vaults/${vaultDID}/members/${removeMember.did}`);
            showSnackbar(`Member ${removeMember.name} removed successfully.`, 'success');
            await fetchMembers();
        } catch (err: any) {
            showSnackbar(`Failed to remove member ${removeMember.name}.`, 'error');
            console.error(err);
        }
        setOpen(false);
        setRemoveMember(null);
    };

    const canManageThisVault = auth?.isOwner || auth?.vaultAdminFor?.includes(vaultDID!);
    if (!auth || !canManageThisVault) {
        return (
            <Box sx={{p:2, textAlign:'center'}}>
                <Typography color="error">Access Denied. You do not have permission to manage members for this vault.</Typography>
            </Box>
        );
    }

    if (!auth) {
        return <Typography sx={{textAlign:'center', mt:2}}>Authentication pending...</Typography>;
    }

    function handleResolve() {
        setDidArg(memberDID);
        setRefresh(n => n + 1);
    }

    return (
        <Box>
            <WarningModal
                title="Remove member"
                warningText={`Remove member from ${vaultDisplayName}?`}
                isOpen={open}
                onClose={handleClose}
                onSubmit={handleRemoveMember}
            />

            <Box sx={{ p: 2, maxWidth: 650 }}>
                <Typography sx={{ mb: 2 }} variant="h6">
                    {isEditing ? 'Edit Member' : 'Add Member'}
                </Typography>
                <Box display="flex" sx={{ gap: 0 }}>
                    <TextField
                        label="Member DID"
                        value={memberDID}
                        onChange={(e) => setMemberDID(e.target.value)}
                        disabled={!!isEditing}
                        sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                            },
                        }}
                        slotProps={{
                            htmlInput: {
                                maxLength: 80,
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleResolve}
                        disabled={!memberDID}
                        sx={{
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                        }}
                    >
                        Resolve
                    </Button>
                </Box>
                <TextField
                    label="Member Friendly Name"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    fullWidth margin="normal"
                    slotProps={{
                        htmlInput: {
                            maxLength: 32,
                        },
                    }}
                />
                <Select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as 'Admin' | 'Moderator' | 'Member')}
                    fullWidth
                    displayEmpty
                    sx={{ mt:1, mb:1 }}
                >
                    <MenuItem value="Member">Member (View/Use Items)</MenuItem>
                    <MenuItem value="Moderator">Moderator (Add/Remove Items, Manage Members)</MenuItem>
                    <MenuItem value="Admin">Admin (Manage Moderators/Members, Items)</MenuItem>
                </Select>
                <Button variant="contained" onClick={handleAddOrUpdateMember} sx={{ mr: 1 }}>
                    {isEditing ? 'Save Changes' : 'Add Member'}
                </Button>
                {isEditing && (
                    <Button variant="outlined" onClick={() => {
                        setIsEditing(null);
                        setMemberDID('');
                        setMemberName('');
                        setMemberRole('Member');}}
                    >
                        Cancel Edit
                    </Button>
                )}
            </Box>

            <Typography variant="h6" sx={{ ml: 2, mt: 1 }}>Current Members</Typography>
            {members.length === 0 && <p>No members added to this vault yet.</p>}
            <List sx={{ maxWidth: 800 }}>
                {members.map((member) => (
                    <React.Fragment key={member.did}>
                        <ListItem
                            secondaryAction={
                                <>
                                    <IconButton edge="end" onClick={() => handleEdit(member)}
                                                sx={{mr: 1}}>
                                        <Edit/>
                                    </IconButton>
                                    <IconButton edge="end"
                                                onClick={() => showRemoveMemberModal(member)}>
                                        <Delete/>
                                    </IconButton>
                                </>
                            }
                        >
                            <ListItemText
                                primary={`${member.name} (${member.role})`}
                                secondary={`DID: ${member.did}
                                            Added: ${format(new Date(member.dateAdded), 'yyyy-MM-dd HH:mm')}`}
                                secondaryTypographyProps={{
                                    whiteSpace: 'pre-line',
                                }}
                            />
                        </ListItem>
                    </React.Fragment>
                ))}
            </List>
            <JsonViewer api={api} didArg={didArg} refresh={refresh} />
        </Box>
    );
}

export default ViewManageVaultMembers;
