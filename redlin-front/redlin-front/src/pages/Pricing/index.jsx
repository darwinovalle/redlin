import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { plans } from './plans';

function PriceTag({ amount, period }) {
  return (
    <Box display="flex" alignItems="baseline" gap={1}>
      <Typography variant="h3" fontWeight={500}>${amount}.00</Typography>
      <Typography variant="body2" color="text.secondary">{period}</Typography>
    </Box>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const [billing, setBilling] = React.useState('monthly');

  const handleChoose = (plan, interval) => {
    const params = new URLSearchParams({ plan: plan.name, interval });
    navigate(`/checkout?${params.toString()}`);
  };

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.paper',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Header */}


          {/* Hero */}
          <Box textAlign="center" mt={8} mb={6} id="pricing">
            <Typography variant="h3" fontWeight={400} gutterBottom>
              Choose the right pricing plan for you
            </Typography>
            <Typography color="text.secondary">Flexible options for individuals and teams</Typography>

            <ToggleButtonGroup
              value={billing}
              exclusive
              onChange={(_, val) => val && setBilling(val)}
              sx={{ mt: 3, backgroundColor: 'background.paper', borderRadius: 999, p: 0.5 }}
            >
              <ToggleButton value="monthly" sx={{ border: 0, px: 2 }}>Monthly</ToggleButton>
              <ToggleButton value="annual" sx={{ border: 0, px: 2 }}>Annual (save ~2 months)</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Plans */}
          <Grid container columnSpacing={10} rowSpacing={4.5}>
            {plans.map((p, idx) => {
              const price = billing === 'monthly' ? p.priceMonthly : p.priceAnnual;
              const period = billing === 'monthly' ? 'per month' : 'per year';
              return (
                <Grid item xs={12} md={4} key={idx}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      backgroundColor: 'background.paper', // same as Login card feel
                      border: '1px solid black',            // identical border to Login form
                      borderRadius: '10px',                 // a bit less rounded
                      boxShadow: '0px 5px 20px 0px rgb(0, 0, 0)', // identical shadow to Login form
                    }}
                  >
                    <CardContent sx={{ pt: '20px', pb: '40px' }}>
                      <Stack spacing={2}>
                        <Typography color="text.secondary" variant="body2">{p.name}</Typography>
                        <PriceTag amount={price} period={period} />
                        <Divider sx={{ borderColor: 'divider', my: 1 }} />
                        <Typography color="text.secondary" variant="body2">Features</Typography>
                        <Stack spacing={1}>
                          {p.features.map((f, i) => (
                            <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                              <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 20 }} />
                              <Typography>{f}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                        <Button
                          fullWidth
                          variant={p.highlighted ? 'outlined' : 'contained'}
                          sx={{
                            mt: 2,
                            ...(p.highlighted
                              ? {
                                  borderColor: 'color-mix(in srgb, var(--color-white) 85%, transparent)',
                                  color: 'var(--color-white)',
                                  '&:hover': {
                                    borderColor: 'var(--color-white)',
                                    backgroundColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)',
                                  },
                                }
                              : {
                                  backgroundColor: 'var(--color-border-mid)', // gray fill
                                  color: 'var(--color-black)', // black text
                                  border: '1px solid color-mix(in srgb, var(--color-white) 16%, transparent)',
                                  '&:hover': {
                                    backgroundColor: 'var(--color-border-grey)',
                                  },
                                }),
                          }}
                          onClick={() => handleChoose(p, billing)}
                        >
                          {p.cta}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>
    </>
  );
}
