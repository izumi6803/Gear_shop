import { useState } from 'react';
import type { PayInput } from '../api/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  amountLabel: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (payment: PayInput) => void;
}

const TEST_CARD = '4242424242424242';

/** Form thẻ dùng chung cho checkout và trả tiền lại đơn chưa thanh toán. */
export function PaymentForm({ amountLabel, busy, submitLabel, onSubmit }: Props) {
  const { t } = useI18n();
  const [cardNumber, setCardNumber] = useState(TEST_CARD);
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('12/29');
  const [cvv, setCvv] = useState('123');

  return (
    <form
      className="payment-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ method: 'card', cardNumber, cardHolder, expiry, cvv });
      }}
    >
      <div className="form-row">
        <label className="form-label" htmlFor="cardNumber">
          {t('checkout.cardNumber')}
        </label>
        <input
          id="cardNumber"
          className="form-control"
          inputMode="numeric"
          value={cardNumber}
          data-testid="pay-card-number"
          onChange={(event) => setCardNumber(event.target.value)}
        />
      </div>
      <div className="form-row">
        <label className="form-label" htmlFor="cardHolder">
          {t('checkout.cardHolder')}
        </label>
        <input
          id="cardHolder"
          className="form-control"
          value={cardHolder}
          data-testid="pay-card-holder"
          onChange={(event) => setCardHolder(event.target.value)}
        />
      </div>
      <div className="form-row-split">
        <div>
          <label className="form-label" htmlFor="expiry">
            {t('checkout.expiry')}
          </label>
          <input
            id="expiry"
            className="form-control"
            value={expiry}
            data-testid="pay-expiry"
            onChange={(event) => setExpiry(event.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="cvv">
            {t('checkout.cvv')}
          </label>
          <input
            id="cvv"
            className="form-control"
            value={cvv}
            data-testid="pay-cvv"
            onChange={(event) => setCvv(event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted small mb-2">{t('checkout.sandbox')}</p>
      <button type="submit" className="btn btn-primary w-100" disabled={busy} data-testid="pay-submit">
        {busy ? t('checkout.paying') : submitLabel.replace('{amount}', amountLabel)}
      </button>
    </form>
  );
}
