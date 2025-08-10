import { useState } from 'react';
import { authService } from '../../services/api';
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
import EmailIcon from '@mui/icons-material/Email';

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userData = await authService.register(username, email, password);
      console.log('Registration successful:', userData);
      navigate('/');
    } catch (err) {
      setError(err.error || 'Registration failed');
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
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
          <img src='vector_illustration.png' width={900}/>
        </Box>

        <form onSubmit={handleRegister}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            width: '300px',
            height: '400px',
            border: 'solid 1px black',
            borderRadius: '15px',
            boxShadow: '0px 5px 20px 0px rgb(0, 0, 0)',
            margin: '0 auto',
          }}>
          <h1 style={{ fontWeight: 'normal'}}>Register</h1>
          {error && <div className="error">{error}</div>}
          
          <TextField
            required
            id="input-username"
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
            id="input-email"
            label="Email"
            type="email"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon />
                  </InputAdornment>
                ),
              },
            }}
            margin='normal'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="standard"
            sx={{ width: '100%' }}
          />

          <TextField
            required
            id="input-password"
            type={showPassword ? 'text' : 'password'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
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

          <Button type="submit" variant='outlined'>Register</Button>

          <p>Already have an account? 
            <Link 
              to='/'
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
              Sign in
            </Link>
          </p>
        </form>
      </Box>
    </ThemeProvider>
  );
};

export default Register;