export default function TestPage({ params }: any) {
  return (
    <html>
      <body>
        <h1>Test Page Works!</h1>
        <p>Locale: {params?.locale || 'undefined'}</p>
      </body>
    </html>
  );
}
