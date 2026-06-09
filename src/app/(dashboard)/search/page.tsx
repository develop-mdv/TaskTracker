import { Suspense } from "react";
import { SearchView } from "@/components/views/search-view";

export default function SearchPage() {
    return (
        <Suspense fallback={<SearchFallback />}>
            <SearchView />
        </Suspense>
    );
}

function SearchFallback() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
    );
}
