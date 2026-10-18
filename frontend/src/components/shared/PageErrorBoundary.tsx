import { Component, type ReactNode } from 'react';

export default class PageErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  render(){
    if(this.state.failed) return <main role="alert" className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">This page could not be loaded</h1><p className="mt-3">Please reload the page. Saved records are kept on the server.</p><button className="mt-5 rounded-lg bg-primary-700 px-5 py-3 text-white" onClick={()=>window.location.reload()}>Reload page</button><a className="ml-4 underline" href={import.meta.env.BASE_URL}>Go to homepage</a></main>;
    return this.props.children;
  }
}
