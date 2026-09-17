import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import RequisitionsScreen from '../(manager)/requisitions';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

describe('Requisitions Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header with back button and title', () => {
    render(<RequisitionsScreen />);
    expect(screen.getByText('Requisitions')).toBeTruthy();
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    render(<RequisitionsScreen />);
    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when requisitions list is empty', () => {
    render(<RequisitionsScreen />);

    // 1. What will be here
    expect(screen.getByText('Your vendor orders will appear here.')).toBeTruthy();

    // 2. Why it matters
    expect(
      screen.getByText('Generate orders and share them directly to your vendors on WhatsApp.')
    ).toBeTruthy();

    // 3. Action
    const draftButton = screen.getByTestId('draft-first-requisition-btn');
    expect(draftButton).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Draft First Requisition' })).toBeTruthy();
    expect(screen.getByText('Draft First Requisition')).toBeTruthy();
  });

  it('triggers navigation when Draft First Requisition button is pressed', () => {
    render(<RequisitionsScreen />);
    const draftButton = screen.getByTestId('draft-first-requisition-btn');
    fireEvent.press(draftButton);
    expect(mockPush).toHaveBeenCalledWith('/(manager)/requisitions/new');
  });
});
