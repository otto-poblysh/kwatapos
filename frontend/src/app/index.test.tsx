import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Home from './index';

describe('Home Screen', () => {
  it('displays the loading state initially', () => {
    render(<Home />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
