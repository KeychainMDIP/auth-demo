import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/");
    });

    return null;
}

export default NotFound;
