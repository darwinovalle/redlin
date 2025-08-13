export const plans = [
  {
    name: 'Basic Plan',
    priceMonthly: 5,
    priceAnnual: 50,
    features: ['Up to 3 projects', '20GB of storage', 'Up to 1 device'],
    cta: 'Choose plan',
    highlighted: false,
  },
  {
    name: 'Professional Plan',
    priceMonthly: 25,
    priceAnnual: 250,
    features: ['Unlimited projects', '150GB of storage', 'Up to 5 devices'],
    cta: 'Choose plan',
    highlighted: true,
  },
  {
    name: 'Business Plan',
    priceMonthly: 45,
    priceAnnual: 450,
    features: ['Unlimited projects', 'Unlimited storage', 'Unlimited devices'],
    cta: 'Choose plan',
    highlighted: false,
  },
];

export const getPlanByName = (name) => plans.find(p => p.name === name);
