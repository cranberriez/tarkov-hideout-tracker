interface NavPlaceholderPageProps {
    title: string;
}

export function NavPlaceholderPage({ title }: NavPlaceholderPageProps) {
    return (
        <main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">{title}</h1>
        </main>
    );
}
