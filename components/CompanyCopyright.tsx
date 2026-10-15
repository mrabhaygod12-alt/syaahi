export default function CompanyCopyright() {
  return (
    <small className="company-copyright">
      © {new Date().getFullYear()}{" "}
      {process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Syaahii Pvt. Ltd."} All
      rights reserved.
    </small>
  );
}
