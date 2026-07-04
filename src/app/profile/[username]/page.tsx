import PublicProfilePage from './PublicProfilePage';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function Page({ params }: Props) {
  const { username } = await params;
  return <PublicProfilePage username={username} />;
}
