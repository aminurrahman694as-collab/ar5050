import { Link } from 'react-router-dom';
import { BRAND } from '../../lib/brand';
import { InfoPage, Section } from './InfoPage';

export default function Terms() {
  return (
    <InfoPage
      title="Terms & Conditions"
      intro={`By using ${BRAND.name} you agree to the terms below. Please read them before ordering or selling.`}
    >
      <Section title="1. About the marketplace">
        <p>
          {BRAND.name} is an online marketplace where independent sellers list and sell their products. The seller of
          each product is shown on its page. We review products before they go live and help with support, but the
          sale itself is between the customer and the seller.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p>
          You must give correct information when you register and order, including a working mobile number, and keep
          your login details private. We may suspend accounts that give false information or misuse the service.
        </p>
      </Section>

      <Section title="3. Orders and prices">
        <ul className="list-disc pl-5 space-y-1">
          <li>Prices are in Bangladeshi Taka (৳). The final price and delivery charge are confirmed by our system when you place the order.</li>
          <li>An order is placed when you confirm it at checkout and stock is available. If an item sells out or is removed, the order can&apos;t be placed.</li>
          <li>You are responsible for giving a complete, correct delivery address and being reachable to receive the order.</li>
        </ul>
      </Section>

      <Section title="4. Payment">
        <p>
          Orders can be paid by Cash on Delivery, where you pay the delivery person when the order arrives, or online
          through the mobile wallet and bank accounts shown at checkout. For online payment you send the exact total
          and give us the Transaction ID; the order is confirmed after we verify the payment. A Transaction ID can be
          used for one order only, and payments we cannot verify may be rejected. Card payment will be added later.
        </p>
      </Section>

      <Section title="5. Delivery">
        <p>
          The delivery charge is based on your Zilla and Thana and is shown at checkout. Each seller ships their own
          items, so an order with several sellers can arrive in separate parcels. Delivery times are estimates, not
          guarantees.
        </p>
      </Section>

      <Section title="6. Cancellations, returns and refunds">
        <ul className="list-disc pl-5 space-y-1">
          <li>Contact us as soon as possible to cancel; an order can be cancelled before the seller ships it.</li>
          <li>If a product arrives damaged, defective, or different from its description, contact us within 3 days of delivery with your order number and photos.</li>
          <li>Approved returns are sent back to <b className="text-white">the seller who sold the product</b>, at that seller&apos;s address. Contact us first so we can confirm the return and give you the correct address.</li>
          <li>Returned items must be unused and in their original condition and packaging, unless the problem is the damage or defect itself.</li>
          <li>Once the return is accepted, you receive a replacement or a refund, as agreed with us.</li>
        </ul>
      </Section>

      <Section title="7. Seller responsibilities">
        <ul className="list-disc pl-5 space-y-1">
          <li>Sellers must be verified before selling and must list only genuine products with accurate descriptions, prices and stock.</li>
          <li>Sellers must pack and ship confirmed orders promptly and accept valid returns for their own products.</li>
          <li>{BRAND.name} charges a commission on each sale. The current rate is set by the platform and applied to each order when it is placed.</li>
          <li>We may reject or remove products, or suspend sellers, that break these terms or the law.</li>
        </ul>
      </Section>

      <Section title="8. Reels and uploaded videos">
        <p>Anyone with an account can post short videos (reels). By posting you agree that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The video is yours, or you have the right to use everything in it, including music, images and brand material. You are responsible for what you post.</li>
          <li>It does not contain nudity or sexual content, violence or threats, hate or harassment, illegal goods or services, scams, or personal information about other people shared without their consent.</li>
          <li>It does not mislead people about a product, its price or its seller. Only a verified seller can attach a product to a reel.</li>
          <li>Videos are limited to 60 seconds and 25 MB, and each account can post up to 10 reels a day.</li>
          <li>Your username must not copy or pretend to be another person, the site or its staff.</li>
          <li>We may hide or delete any reel, and restrict or block accounts that break these rules, with or without notice. You can delete your own reels at any time from your profile.</li>
        </ul>
      </Section>

      <Section title="9. Prohibited use">
        <p>
          You may not use the site for anything unlawful, to sell prohibited or counterfeit goods, to upload harmful
          content, or to interfere with how the site works.
        </p>
      </Section>

      <Section title="10. Changes to these terms">
        <p>We may update these terms from time to time. The version on this page is the one that applies.</p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about these terms? Call {BRAND.contact.phone} or email {BRAND.contact.email}, or visit our{' '}
          <Link to="/contact" className="text-primary-400 hover:text-primary-300">Contact page</Link>.
        </p>
      </Section>
    </InfoPage>
  );
}
