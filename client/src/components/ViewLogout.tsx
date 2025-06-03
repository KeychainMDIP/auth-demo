import {useNavigate} from "react-router-dom";
import {useSnackbar} from "../contexts/SnackbarContext.js";
import {useEffect} from "react";
import {AxiosInstance} from "axios";

function ViewLogout({ api } : { api: AxiosInstance }) {
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();

    useEffect(() => {
        const init = async () => {
            try {
                await api.post(`/logout`);
                navigate('/');
            }
            catch (error: any) {
                showSnackbar("Failed to logout", 'error');
                navigate('/');
            }
        };

        init();
    }, [navigate, showSnackbar]);

    return null;
}

export default ViewLogout;
