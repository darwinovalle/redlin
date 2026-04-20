import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectRoute = ({ children, user }) => {
    const hasNotifiedRef = useRef(false);

    useEffect(() => {
        if (!user && !hasNotifiedRef.current) {
            alert('You have to be logged in to access this page');
            hasNotifiedRef.current = true;
        }

        if (user) {
            hasNotifiedRef.current = false;
        }
    }, [user]);

    if (!user) {
        return <Navigate to="/" replace />
    }

    return children;
}


export default ProtectRoute;