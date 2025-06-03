import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    IconButton,
    InputAdornment,
    Typography,
    Box
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    itemDetails: {
        site?: string;
        username?: string;
        password?: string;
    } | null;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
                                                               isOpen,
                                                               onClose,
                                                               title,
                                                               itemDetails,
                                                           }) => {
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowPassword(false);
        }
    }, [isOpen, itemDetails]);

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    if (!itemDetails) {
        return null;
    }

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                {itemDetails.site && (
                    <Box mb={2}>
                        <Typography variant="caption" display="block" color="textSecondary">
                            Service/Site
                        </Typography>
                        <TextField
                            value={itemDetails.site}
                            fullWidth
                            InputProps={{ readOnly: true }}
                            variant="outlined"
                            size="small"
                        />
                    </Box>
                )}
                {itemDetails.username && (
                    <Box mb={2}>
                        <Typography variant="caption" display="block" color="textSecondary">
                            Username/Email
                        </Typography>
                        <TextField
                            value={itemDetails.username}
                            fullWidth
                            InputProps={{ readOnly: true }}
                            variant="outlined"
                            size="small"
                        />
                    </Box>
                )}
                {itemDetails.password !== undefined && (
                    <Box mb={1}>
                        <Typography variant="caption" display="block" color="textSecondary">
                            Password
                        </Typography>
                        <TextField
                            type={showPassword ? 'text' : 'password'}
                            value={itemDetails.password}
                            fullWidth
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={handleClickShowPassword}
                                            onMouseDown={handleMouseDownPassword}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            variant="outlined"
                            size="small"
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary" variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ItemDetailsModal;
