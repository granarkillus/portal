"use client";

import { useEffect, useState } from "react";
import FormsPage from "./forms/page";

// portal.xing.wtf opens straight to the officer start screen; most officers
// never sign in. Sign-in lives at /signin.
//
// Email links from Supabase (account confirmation, magic links) still land
// here with their token in the address, so those are passed on to /signin,
// which picks the token up and finishes signing in.
export default function Home() {
  const [authLink, setAuthLink] = useState(false);
  useEffect(() => {
    const { hash, search } = window.location;
    if (/access_token|error_description|type=(signup|recovery|magiclink|invite)/.test(hash) || /[?&](code|token_hash)=/.test(search)) {
      setAuthLink(true);
      window.location.replace(`/signin${search}${hash}`);
    }
  }, []);
  if (authLink) return null;
  return <FormsPage />;
}
