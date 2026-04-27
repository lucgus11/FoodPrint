export default function StarRating({ value = 0, onChange, size = '1.4rem', readOnly = false }) {
  return (
    <div className="stars" role={readOnly ? 'img' : 'group'} aria-label={`${value} étoiles sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`star ${n <= value ? 'filled' : 'empty'}`}
          style={{ fontSize: size, cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => onChange?.(n === value ? 0 : n)}
          role={readOnly ? undefined : 'button'}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}
