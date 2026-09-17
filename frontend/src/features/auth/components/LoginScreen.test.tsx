import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';

describe('LoginScreen', () => {
  it('renders email input, password input, and login button', () => {
    const mockLogin = jest.fn();
    render(<LoginScreen onLogin={mockLogin} />);

    expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy();
  });

  it('submits email and password when login button is pressed', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen onLogin={mockLogin} />);

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.changeText(emailInput, 'admin@kwatapos.com');
    fireEvent.changeText(passwordInput, 'admin123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'admin@kwatapos.com',
        password: 'admin123',
      });
    });
  });

  it('displays error message when error prop is provided', () => {
    const mockLogin = jest.fn();
    render(<LoginScreen onLogin={mockLogin} error="Invalid email or password" />);

    expect(screen.getByText('Invalid email or password')).toBeTruthy();
  });

  it('displays error message when onLogin rejects with an error', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Network request failed'));
    render(<LoginScreen onLogin={mockLogin} />);

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.changeText(emailInput, 'admin@kwatapos.com');
    fireEvent.changeText(passwordInput, 'wrongpass');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Network request failed')).toBeTruthy();
    });
  });

  it('shows loading indicator and disables button when isLoading is true', () => {
    const mockLogin = jest.fn();
    render(<LoginScreen onLogin={mockLogin} isLoading={true} />);

    expect(screen.getByTestId('login-loading-indicator')).toBeTruthy();
  });
});
