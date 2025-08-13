import { useState } from 'react';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import { darkTheme } from '../../theme'; 
import { ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';
import Button from '@mui/material/Button';
import { Link } from 'react-router-dom';
import AccountCircle from '@mui/icons-material/AccountCircle';
import InputAdornment from '@mui/material/InputAdornment';

import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';



const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };
  const handleMouseUpPassword = (event) => {
    event.preventDefault();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userData = await authService.login(username, password);
      login(userData);
      navigate('/home');
      console.log('Login successful:', userData);
      // Handle successful login (e.g., store user data, redirect)
    } catch (err) {
      setError(err.error || 'Login failed');
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>

    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}
    >

    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px',
      width: '50%',
      minHeight: '100vh',
      borderRadius: '15px',
      backgroundColor: 'rgb(255, 255, 255)',
    }}>
      <img src='pngwing.com.png' width={1400}/>'
    </Box>
    <form onSubmit={handleLogin}
      style={{ display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        width: '300px',
        height: '350px',
        border: 'solid 1px black',
        borderRadius: '15px',
        boxShadow: '0px 5px 20px 0px rgb(0, 0, 0)',
        margin: '0 auto',

    }}>
    <h1 style={{ fontWeight: 'normal'}}>Login</h1>
      {error && <div className="error">{error}</div>}
      {/* <TextField
        required
        id='outlined-required'
        label='Username'
        margin='normal'
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      /> */}
      <TextField
        required
        id="input-with-icon-textfield"
        label="Username"
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="start">
                <AccountCircle />
              </InputAdornment>
            ),
          },
        }}
        margin='normal'
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        variant="standard"
        sx={{ width: '100%' }}
      />
      <TextField
            required
            id="input-with-icon-password"
            type={showPassword ? 'text' : 'password'}
            slotProps={{
              input: {
                endAdornment: (

              <InputAdornment position="end">
                <IconButton
                  aria-label={
                    showPassword ? 'hide the password' : 'display the password'
                  }
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  onMouseUp={handleMouseUpPassword}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                
                </IconButton>
              </InputAdornment>
                )
              }
            }}
            margin='normal'
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="standard"
            sx={{ width: '100%', marginBottom: '30px' }}
          />
      {/* <TextField
        required
        id='outlined-required'
        label='Password'
        margin='normal'
        type="password"
        value={password}

        onChange={(e) => setPassword(e.target.value)}
        placeholder="********"
      /> */}
      <Button type="submit" variant='outlined'  >login</Button>

     <p>Don't have an account? 
  <Link 
    to='/register'
    style={{
      color: '#90caf9',
      textDecoration: 'none',
      marginLeft: '5px',
      fontWeight: 'bold',
      transition: 'color 0.3s ease',
    }}
    onMouseEnter={(e) => e.target.style.color = '#64b5f6'}
    onMouseLeave={(e) => e.target.style.color = '#90caf9'}
  >
    Sign up
  </Link>
</p> 
    </form>

    </Box>

    </ThemeProvider>
  );
};

export default Login;