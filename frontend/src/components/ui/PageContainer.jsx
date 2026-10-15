import styles from './PageContainer.module.css';

export default function PageContainer({ children, wide = false }) {
  return (
    <div className={wide ? styles.containerWide : styles.container}>
      {children}
    </div>
  );
}