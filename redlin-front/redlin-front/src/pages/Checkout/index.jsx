import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  CssBaseline,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '../../theme';
import { getPlanByName } from '../Pricing/plans';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Checkout() {
  const query = useQuery();
  const navigate = useNavigate();
  const planName = query.get('plan');
  const interval = query.get('interval') === 'annual' ? 'annual' : 'monthly';
  const plan = getPlanByName(planName) || getPlanByName('Professional Plan');

  const amount = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  const periodLabel = interval === 'annual' ? 'Billed yearly' : 'Billed monthly';

  const [form, setForm] = useState({
    email: '',
    number: '',
    exp: '',
    cvc: '',
    name: '',
    country: '',
    zip: '',
  });

  const onChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    // For now just mock success and go back home
    alert(`Subscribed to ${plan.name} (${interval})`);
    navigate('/home');
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.paper', py: { xs: 2, md: 6 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {/* Summary */}
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Your order</Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography fontWeight={600}>{plan.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{periodLabel}</Typography>
                    </Box>
                    <Divider />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography>Subtotal</Typography>
                      <Typography>${amount}.00</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>Total due today</Typography>
                      <Typography fontWeight={700}>${amount}.00</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Payment */}
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Payment</Typography>
                  <Stack spacing={2} component="form" onSubmit={onSubmit}>
                    <TextField label="Email" type="email" required value={form.email} onChange={onChange('email')} fullWidth />
                    <Typography variant="subtitle2">Payment method</Typography>
                    <RadioGroup row value="card">
                      <FormControlLabel value="card" control={<Radio />} label="Card" />
                    </RadioGroup>
                    <TextField label="Card number" placeholder="1234 1234 1234 1234" required value={form.number} onChange={onChange('number')} fullWidth />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField label="MM / YY" required value={form.exp} onChange={onChange('exp')} fullWidth />
                      <TextField label="CVC" required value={form.cvc} onChange={onChange('cvc')} fullWidth />
                    </Stack>
                    <TextField label="Name on card" required value={form.name} onChange={onChange('name')} fullWidth />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField label="Country or region" required value={form.country} onChange={onChange('country')} fullWidth />
                      <TextField label="ZIP" required value={form.zip} onChange={onChange('zip')} fullWidth />
                    </Stack>
                    <Button type="submit" variant="contained" size="large">Subscribe</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
