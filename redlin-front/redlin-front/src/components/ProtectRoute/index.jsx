import { Navigate } from "react-router-dom";

const ProtectRoute = ({ children, user }) => {

    if (!user) {
        alert('You have to be logged in to access this page')
        return <Navigate to="/" />
    }

    return children;
}


export default ProtectRoute;