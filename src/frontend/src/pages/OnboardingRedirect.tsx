import { useEffect } from 'react';
import { useNavigate } from '../router';

export function OnboardingRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/?new=1');
  }, [navigate]);
  return null;
}
