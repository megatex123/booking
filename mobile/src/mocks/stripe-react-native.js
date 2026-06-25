import React from 'react';

export const StripeProvider = ({ children }) => children;
export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: null }),
  presentPaymentSheet: async () => ({ error: null }),
  confirmPayment: async () => ({ error: null, paymentIntent: null }),
});
export const CardField = () => null;
export const CardForm = () => null;
export const ApplePayButton = () => null;
export const GooglePayButton = () => null;
export const createToken = async () => ({ token: null, error: null });
export const createPaymentMethod = async () => ({ paymentMethod: null, error: null });
export default { StripeProvider, useStripe };
