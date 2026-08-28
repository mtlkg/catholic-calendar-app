DELETE FROM tickets WHERE order_id = '16169cb2-aefd-4a44-84fb-d233010d75f0';
DELETE FROM orders WHERE id = '16169cb2-aefd-4a44-84fb-d233010d75f0';

INSERT INTO orders (customer_name, customer_email, customer_phone, order_type, quantity, total_amount, status, payment_method, bucket_allocations, dropped_in_box)
VALUES (
  'Marie Tremblay',
  'marie.tremblay@example.com',
  '514-555-0182',
  'gift_raffle',
  20,
  20.00,
  'paid',
  'card',
  '{"dac86211-ffae-4dc5-aa00-09a1d2fa9a1f": 12, "1bc680f6-c066-4352-9fae-1c364c2dc9bb": 8}'::jsonb,
  true
);